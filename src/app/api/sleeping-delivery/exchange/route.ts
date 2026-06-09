import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CAT_PHOTOS_BUCKET,
  getDataUrlExtension,
  getStoragePhotoPath,
  isUsablePhotoSrc,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import type { ExchangePhoto } from "../../../../lib/home/sleepingPhotos";
import {
  isBlockedDeliveryPhotoUrl,
  isBlockedDeliveryPoolRow,
  isStorageDeliveryPhotoUrl,
} from "../../../../lib/home/deliveryPoolGuards";

export const dynamic = "force-dynamic";

type ExchangeRequest = {
  ownPhoto?: {
    id?: string;
    catId?: string;
    ownerCatId?: string;
    src?: string;
    createdAt?: number;
    triggerLabel?: string;
    theme?: string;
  };
  triggerLabel?: string;
  theme?: string;
  category?: string;
  seed?: string;
  recipientCatId?: string | null;
  anonymousId?: string | null;
  blockedPhotoIds?: string[];
  preferredSourcePhotoId?: string | null;
  debugDryRun?: boolean;
};

type RemoteCatMomentRow = {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  local_moment_id: string;
  local_cat_id: string;
  owner_cat_id: string;
  photo_url: string;
  delivery_status: "available" | "hidden" | "reported";
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Candidate = {
  row: RemoteCatMomentRow;
  src: string;
  tags: string[];
};

type ExchangeRequestParseResult =
  | { ok: true; input: Required<ExchangeRequest> }
  | {
      ok: false;
      status: 400 | 413;
      error: "invalid_json" | "invalid_exchange_request" | "payload_too_large";
    };

type ExchangeValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 400 | 413 | 415;
      error:
        | "invalid_exchange_request"
        | "payload_too_large"
        | "unsupported_media_type";
    };

type RateLimitBucket = {
  minuteStartedAt: number;
  minuteCount: number;
  hourStartedAt: number;
  hourCount: number;
  updatedAt: number;
};

const MAX_JSON_BODY_LENGTH = 3 * 1024 * 1024;
const MAX_OWN_PHOTO_SRC_LENGTH = 2 * 1024 * 1024;
const MAX_OWN_PHOTO_BYTES = 1536 * 1024;
const MAX_BLOCKED_PHOTO_IDS = 100;
const MAX_ID_LENGTH = 160;
const MAX_TEXT_LENGTH = 120;
const MIN_CREATED_AT = Date.UTC(2020, 0, 1);
const MAX_CREATED_AT_FUTURE_DRIFT_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_PER_HOUR = 60;
const RATE_LIMIT_WINDOW_MINUTE_MS = 60 * 1000;
const RATE_LIMIT_WINDOW_HOUR_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_BUCKETS = 1000;
const exchangeRateLimitBuckets = new Map<string, RateLimitBucket>();

export async function POST(request: Request) {
  const parsedInput = await readExchangeRequest(request);

  if (!parsedInput.ok) {
    return exchangeError(parsedInput.error, parsedInput.status);
  }

  const input = parsedInput.input;
  const inputValidation = validateExchangeRequest(input);

  if (!inputValidation.ok) {
    return exchangeError(inputValidation.error, inputValidation.status);
  }

  const rateLimit = checkExchangeRateLimit(
    buildRateLimitKey(request, input.anonymousId),
  );

  if (!rateLimit.allowed) {
    return exchangeError("too_many_requests", 429);
  }

  const debugDryRun =
    input.debugDryRun === true && process.env.NODE_ENV !== "production";
  const serverSupabase = await createServerSupabaseClient();
  const { data: userData } = serverSupabase
    ? await serverSupabase.auth.getUser()
    : { data: { user: null } };
  const userId = userData.user?.id ?? null;
  const anonymousId = userId ? null : input.anonymousId;
  const adminSupabase = createSupabaseAdminClient();
  const supabase = adminSupabase ?? serverSupabase;

  if (!supabase) {
    return NextResponse.json(
      { photo: null, source: "none", error: "server_unavailable" },
      { status: 503 },
    );
  }

  if (!isValidOwnPhotoInput(input) || (!userId && !anonymousId)) {
    return NextResponse.json(
      { photo: null, source: "none", error: "invalid_exchange_request" },
      { status: 400 },
    );
  }

  const ownPhoto = input.ownPhoto;
  const createdAt = new Date(ownPhoto.createdAt ?? Date.now()).toISOString();
  const ownerCatId = ownPhoto.ownerCatId || ownPhoto.catId;
  const shouldAddOwnPhotoToPool = !isBlockedDeliveryPhotoUrl(ownPhoto.src);

  if (!debugDryRun && shouldAddOwnPhotoToPool) {
    const ownPhotoUrl = await prepareExchangeMomentPhotoUrl({
      supabase,
      userId,
      anonymousId,
      ownerCatId,
      localMomentId: ownPhoto.id,
      src: ownPhoto.src,
      canUseStorage: Boolean(adminSupabase),
    });

    await deleteExistingMoment({
      supabase,
      userId,
      anonymousId,
      localMomentId: ownPhoto.id,
    });

    const { error: momentError } = await supabase.from("cat_moments").insert({
      user_id: userId,
      anonymous_id: anonymousId,
      local_moment_id: ownPhoto.id,
      local_cat_id: ownPhoto.catId,
      owner_cat_id: ownerCatId,
      photo_url: ownPhotoUrl,
      state: "sleeping",
      visibility: "shared",
      delivery_status: "available",
      source_moment_id: null,
      metadata: {
        source: "user",
        pool_kind: "user_shared",
        trigger_label: input.triggerLabel,
        theme: input.theme,
        category: input.category,
        shared: true,
      },
      captured_at: createdAt,
      created_at: createdAt,
    });

    if (momentError) {
      return NextResponse.json(
        { photo: null, source: "none", error: momentError.message },
        { status: 500 },
      );
    }
  }

  const blockedPhotoIds = new Set(input.blockedPhotoIds ?? []);
  const remoteRows = await readRemoteCandidateRows(supabase);
  const diagnosticsBase = buildDiagnostics(remoteRows, blockedPhotoIds);
  const deliverableContext = {
    userId,
    anonymousId,
    recipientCatId: input.recipientCatId,
    excludePhotoId: ownPhoto.id,
    blockedPhotoIds,
  };
  const candidates = await buildCandidates(
    remoteRows.filter((row) => isRowDeliverable(row, deliverableContext)),
    supabase,
  );
  const fallbackCandidates =
    candidates.length === 0
      ? await buildCandidates(
          remoteRows.filter((row) =>
            isFallbackDeliverable(row, deliverableContext),
          ),
          supabase,
        )
      : [];
  const candidatePool =
    candidates.length > 0 ? candidates : fallbackCandidates;
  const selected = selectCandidate(candidatePool, input);

  if (!selected) {
    return NextResponse.json({
      photo: null,
      source: "none",
      diagnostics: {
        ...diagnosticsBase,
        source: "none",
        candidateCount: candidatePool.length,
        normalCandidateCount: candidates.length,
        fallbackCandidateCount: fallbackCandidates.length,
        fallbackActive: candidates.length === 0 && fallbackCandidates.length > 0,
        excludedCount: Math.max(0, diagnosticsBase.availableCount - candidatePool.length),
      },
    });
  }

  const localDeliveryId = `delivered-sleeping-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  const deliveredAt = new Date();
  const photo: ExchangePhoto = {
    id: localDeliveryId,
    sourcePhotoId: selected.row.local_moment_id,
    src: selected.src,
    title: "ほかの猫のねがお",
    subtitle: "",
    triggerLabel: input.triggerLabel,
    theme: input.theme,
    deliveredAt: deliveredAt.getTime(),
  };

  if (!debugDryRun) {
    const { error: deliveryError } = await supabase
      .from("cat_moment_deliveries")
      .insert({
        user_id: userId,
        anonymous_id: anonymousId,
        local_delivery_id: localDeliveryId,
        source_moment_id: selected.row.id,
        source_photo_id: selected.row.local_moment_id,
        recipient_local_cat_id: input.recipientCatId,
        photo_url: selected.row.photo_url,
        status: "delivered",
        metadata: {
          source: "server_exchange",
          source_pool_kind: readPoolKind(selected.row.metadata),
          trigger_label: input.triggerLabel,
          theme: input.theme,
          category: input.category,
        },
        delivered_at: deliveredAt.toISOString(),
      });

    if (deliveryError) {
      return NextResponse.json(
        { photo: null, source: "none", error: deliveryError.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    photo,
    source: "remote",
    diagnostics: {
      ...diagnosticsBase,
      source: "remote",
      candidateCount: candidatePool.length,
      normalCandidateCount: candidates.length,
      fallbackCandidateCount: fallbackCandidates.length,
      fallbackActive: candidates.length === 0 && fallbackCandidates.length > 0,
      excludedCount: Math.max(0, diagnosticsBase.availableCount - candidatePool.length),
    },
  });
}

async function readExchangeRequest(request: Request): Promise<ExchangeRequestParseResult> {
  const rawBody = await request.text().catch(() => "");

  if (rawBody.length > MAX_JSON_BODY_LENGTH) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  let body: ExchangeRequest;

  try {
    body = JSON.parse(rawBody || "{}") as ExchangeRequest;
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }

  if (
    Array.isArray(body.blockedPhotoIds) &&
    body.blockedPhotoIds.length > MAX_BLOCKED_PHOTO_IDS
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return {
    ok: true,
    input: {
      ownPhoto: body.ownPhoto ?? {},
      triggerLabel: toStringOrDefault(body.triggerLabel, "ねがお"),
      theme: toStringOrDefault(body.theme, "sleeping"),
      category: toStringOrDefault(body.category, "sleeping"),
      seed: toStringOrDefault(body.seed, String(Date.now())),
      recipientCatId: toStringOrNull(body.recipientCatId),
      anonymousId: toStringOrNull(body.anonymousId),
      blockedPhotoIds: Array.isArray(body.blockedPhotoIds)
        ? body.blockedPhotoIds.filter((id) => typeof id === "string")
        : [],
      preferredSourcePhotoId: toStringOrNull(body.preferredSourcePhotoId),
      debugDryRun: body.debugDryRun === true,
    },
  };
}

function isValidOwnPhotoInput(
  input: Required<ExchangeRequest>,
): input is Required<ExchangeRequest> & {
  ownPhoto: {
    id: string;
    catId: string;
    ownerCatId?: string;
    src: string;
    createdAt?: number;
  };
} {
  return Boolean(
    typeof input.ownPhoto.id === "string" &&
      typeof input.ownPhoto.catId === "string" &&
      typeof input.ownPhoto.src === "string" &&
      input.ownPhoto.src,
  );
}

function validateExchangeRequest(
  input: Required<ExchangeRequest>,
): ExchangeValidationResult {
  if (!isValidOwnPhotoInput(input)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  const ownPhoto = input.ownPhoto;
  const stringFields = [
    ownPhoto.id,
    ownPhoto.catId,
    ownPhoto.ownerCatId,
    input.anonymousId,
    input.recipientCatId,
    input.preferredSourcePhotoId,
  ].filter((value): value is string => typeof value === "string");

  if (stringFields.some((value) => value.length > MAX_ID_LENGTH)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  const textFields = [
    input.triggerLabel,
    input.theme,
    input.category,
    input.seed,
    ownPhoto.triggerLabel,
    ownPhoto.theme,
  ].filter((value): value is string => typeof value === "string");

  if (textFields.some((value) => value.length > MAX_TEXT_LENGTH)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    input.blockedPhotoIds.length > MAX_BLOCKED_PHOTO_IDS ||
    input.blockedPhotoIds.some((id) => id.length > MAX_ID_LENGTH)
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    typeof ownPhoto.createdAt === "number" &&
    (!Number.isFinite(ownPhoto.createdAt) ||
      ownPhoto.createdAt < MIN_CREATED_AT ||
      ownPhoto.createdAt > Date.now() + MAX_CREATED_AT_FUTURE_DRIFT_MS)
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return validateOwnPhotoDataUrl(ownPhoto.src);
}

function validateOwnPhotoDataUrl(src: string): ExchangeValidationResult {
  if (!src || !src.startsWith("data:")) {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }

  if (src.length > MAX_OWN_PHOTO_SRC_LENGTH) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const match = src.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/]+={0,2})$/,
  );

  if (!match) {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }

  const mime = match[1];
  const base64 = match[2];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;

  if (base64.length % 4 !== 0 || byteLength <= 0) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (byteLength > MAX_OWN_PHOTO_BYTES) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const header = Buffer.from(base64.slice(0, 32), "base64");

  if (!hasExpectedImageMagicNumber(mime, header)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return { ok: true };
}

function hasExpectedImageMagicNumber(mime: string, header: Buffer) {
  if (mime === "image/jpeg") {
    return header[0] === 0xff && header[1] === 0xd8;
  }

  if (mime === "image/png") {
    return (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    );
  }

  if (mime === "image/webp") {
    return (
      header.toString("ascii", 0, 4) === "RIFF" &&
      header.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
}

function buildRateLimitKey(request: Request, anonymousId: string | null) {
  if (anonymousId) {
    return `anon:${anonymousId}`;
  }

  return `ip:${readClientIp(request)}`;
}

function readClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function checkExchangeRateLimit(key: string) {
  const now = Date.now();
  const existing = exchangeRateLimitBuckets.get(key);
  const bucket: RateLimitBucket = existing
    ? {
        minuteStartedAt:
          now - existing.minuteStartedAt > RATE_LIMIT_WINDOW_MINUTE_MS
            ? now
            : existing.minuteStartedAt,
        minuteCount:
          now - existing.minuteStartedAt > RATE_LIMIT_WINDOW_MINUTE_MS
            ? 0
            : existing.minuteCount,
        hourStartedAt:
          now - existing.hourStartedAt > RATE_LIMIT_WINDOW_HOUR_MS
            ? now
            : existing.hourStartedAt,
        hourCount:
          now - existing.hourStartedAt > RATE_LIMIT_WINDOW_HOUR_MS
            ? 0
            : existing.hourCount,
        updatedAt: now,
      }
    : {
        minuteStartedAt: now,
        minuteCount: 0,
        hourStartedAt: now,
        hourCount: 0,
        updatedAt: now,
      };

  bucket.minuteCount += 1;
  bucket.hourCount += 1;
  exchangeRateLimitBuckets.set(key, bucket);
  pruneRateLimitBuckets(now);

  return {
    allowed:
      bucket.minuteCount <= RATE_LIMIT_PER_MINUTE &&
      bucket.hourCount <= RATE_LIMIT_PER_HOUR,
  };
}

function pruneRateLimitBuckets(now: number) {
  if (exchangeRateLimitBuckets.size <= RATE_LIMIT_MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of exchangeRateLimitBuckets) {
    if (now - bucket.updatedAt > RATE_LIMIT_WINDOW_HOUR_MS * 2) {
      exchangeRateLimitBuckets.delete(key);
    }
  }
}

function exchangeError(error: string, status: 400 | 413 | 415 | 429) {
  return NextResponse.json({ photo: null, source: "none", error }, { status });
}

async function deleteExistingMoment({
  supabase,
  userId,
  anonymousId,
  localMomentId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  localMomentId: string;
}) {
  let query = supabase.from("cat_moments").delete().eq("local_moment_id", localMomentId);

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.is("user_id", null).eq("anonymous_id", anonymousId);
  }

  await query;
}

async function readRemoteCandidateRows(
  supabase: SupabaseClient,
) {
  const { data } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, delivery_status, metadata, created_at",
    )
    .eq("visibility", "shared")
    .in("delivery_status", ["available", "hidden", "reported"])
    .order("created_at", { ascending: false })
    .limit(160);

  return (data ?? []) as RemoteCatMomentRow[];
}

function isRowDeliverable(
  row: RemoteCatMomentRow,
  {
    userId,
    anonymousId,
    recipientCatId,
    excludePhotoId,
    blockedPhotoIds,
  }: {
    userId: string | null;
    anonymousId: string | null;
    recipientCatId: string | null;
    excludePhotoId: string;
    blockedPhotoIds: Set<string>;
  },
) {
  if (isBlockedDeliveryPoolRow(row)) {
    return false;
  }
  if (
    isStorageDeliveryPhotoUrl(row.photo_url) &&
    readPoolKind(row.metadata) !== "admin_stock"
  ) {
    return false;
  }
  if (!isUsablePhotoSrc(row.photo_url) || row.delivery_status !== "available") {
    return false;
  }
  if (userId && row.user_id === userId) {
    return false;
  }
  if (!userId && anonymousId && row.anonymous_id === anonymousId) {
    return false;
  }
  if (
    recipientCatId &&
    (row.local_cat_id === recipientCatId || row.owner_cat_id === recipientCatId)
  ) {
    return false;
  }
  if (row.id === excludePhotoId || row.local_moment_id === excludePhotoId) {
    return false;
  }

  return !blockedPhotoIds.has(row.id) && !blockedPhotoIds.has(row.local_moment_id);
}

function isFallbackDeliverable(
  row: RemoteCatMomentRow,
  context: Parameters<typeof isRowDeliverable>[1],
) {
  if (isBlockedDeliveryPoolRow(row)) {
    return false;
  }
  if (!isUsablePhotoSrc(row.photo_url) || row.delivery_status !== "available") {
    return false;
  }
  if (row.id === context.excludePhotoId || row.local_moment_id === context.excludePhotoId) {
    return false;
  }

  return readPoolKind(row.metadata) === "admin_stock" ||
    readPoolKind(row.metadata) === "user_shared";
}

async function buildCandidates(
  rows: RemoteCatMomentRow[],
  supabase: SupabaseClient,
) {
  const candidates = await Promise.all(
    rows.map(async (row): Promise<Candidate | null> => {
      const src = await resolvePhotoUrl(row.photo_url, supabase);

      if (!src || !isUsablePhotoSrc(src)) {
        return null;
      }

      return {
        row,
        src,
        tags: readTags(row.metadata),
      };
    }),
  );

  return candidates.filter((candidate): candidate is Candidate => Boolean(candidate));
}

async function resolvePhotoUrl(photoUrl: string, supabase: SupabaseClient) {
  const storagePath = getStoragePhotoPath(photoUrl);

  if (storagePath) {
    const { data, error } = await supabase.storage
      .from(CAT_PHOTOS_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  }

  return photoUrl;
}

async function prepareExchangeMomentPhotoUrl({
  supabase,
  userId,
  anonymousId,
  ownerCatId,
  localMomentId,
  src,
  canUseStorage,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  ownerCatId: string;
  localMomentId: string;
  src: string;
  canUseStorage: boolean;
}) {
  if (!src.startsWith("data:image/") || !canUseStorage) {
    return src;
  }

  const ownerKey = userId ?? anonymousId ?? "anonymous";
  try {
    const storagePath = await uploadDataUrl(
      supabase,
      `${sanitizePathSegment(ownerKey)}/${sanitizePathSegment(ownerCatId)}/sleeping/${sanitizePathSegment(
        localMomentId,
      )}.${getDataUrlExtension(src)}`,
      src,
    );

    return toStoragePhotoUrl(storagePath);
  } catch {
    return src;
  }
}

function selectCandidate(candidates: Candidate[], input: Required<ExchangeRequest>) {
  if (candidates.length === 0) {
    return null;
  }

  if (input.preferredSourcePhotoId) {
    const preferredCandidate = candidates.find(
      (candidate) =>
        candidate.row.id === input.preferredSourcePhotoId ||
        candidate.row.local_moment_id === input.preferredSourcePhotoId,
    );

    if (preferredCandidate) {
      return preferredCandidate;
    }
  }

  const index =
    hashText(`${input.seed}:${input.triggerLabel}:${input.theme}`) %
    candidates.length;

  return candidates[index];
}

function buildDiagnostics(
  rows: RemoteCatMomentRow[],
  blockedPhotoIds: Set<string>,
) {
  const availableRows = rows.filter((row) => row.delivery_status === "available");
  const usableAvailableRows = availableRows.filter((row) =>
    isUsablePhotoSrc(row.photo_url),
  );

  return {
    source: "none" as const,
    availableCount: availableRows.length,
    candidateCount: usableAvailableRows.length,
    normalCandidateCount: usableAvailableRows.length,
    fallbackCandidateCount: 0,
    fallbackActive: false,
    excludedCount: 0,
    unusableCount: Math.max(0, availableRows.length - usableAvailableRows.length),
    blockedCount: availableRows.filter(
      (row) => blockedPhotoIds.has(row.id) || blockedPhotoIds.has(row.local_moment_id),
    ).length,
    adminStockCount: availableRows.filter(
      (row) => readPoolKind(row.metadata) === "admin_stock",
    ).length,
    userSharedCount: availableRows.filter(
      (row) => readPoolKind(row.metadata) === "user_shared",
    ).length,
    hiddenCount: rows.filter((row) => row.delivery_status === "hidden").length,
    reportedCount: rows.filter((row) => row.delivery_status === "reported").length,
    rlsReadable: true,
    checkedAt: new Date().toISOString(),
  };
}

function readTags(metadata: Record<string, unknown> | null) {
  const tags = ["sleeping", "ねてる"];
  const theme = metadata?.theme;
  const triggerLabel = metadata?.trigger_label;

  if (typeof theme === "string" && theme) {
    tags.push(theme);
  }
  if (typeof triggerLabel === "string" && triggerLabel) {
    tags.push(triggerLabel);
  }

  return [...new Set(tags)];
}

function readPoolKind(metadata: Record<string, unknown> | null) {
  const poolKind = metadata?.pool_kind;

  if (poolKind === "admin_stock" || poolKind === "user_shared") {
    return poolKind;
  }

  return "unknown";
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function toStringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
