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
import {
  isOwnStoragePath,
  isSafeStoragePath,
} from "../../../../lib/photoStorageAuthorization";
import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import type { ExchangePhoto } from "../../../../lib/home/sleepingPhotos";
import {
  isBlockedDeliveryPhotoUrl,
  isBlockedDeliveryPoolRow,
} from "../../../../lib/home/deliveryPoolGuards";
import {
  getServerJstDateKey,
  isServerDateKey,
  validateServerDeliveryDateKey,
} from "../../../../lib/home/eveningDeliveryServer";

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
  deliveryDateKey?: string | null;
  recipientCatId?: string | null;
  anonymousId?: string | null;
  blockedPhotoIds?: string[];
  preferredSourcePhotoId?: string | null;
  debugDryRun?: boolean;
  mode?: "onboarding" | null;
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
  moderation_status?: "pending" | "approved" | "rejected";
  pool_date?: string | null;
  delivery_count?: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type FastStockCandidateRow = Omit<RemoteCatMomentRow, "photo_url">;

type RemoteDeliveryRow = {
  id: string;
  local_delivery_id: string;
  source_moment_id: string | null;
  source_photo_id: string | null;
  recipient_local_cat_id: string | null;
  photo_url: string;
  status: string;
  metadata: Record<string, unknown> | null;
  delivered_at: string;
};

type Candidate = {
  row: RemoteCatMomentRow;
  src: string;
  tags: string[];
  tier: DeliveryTier;
};

type DeliveryTier = 1 | 2 | 3;

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
      status: 400 | 401 | 403 | 413 | 415;
      error:
        | "invalid_exchange_request"
        | "payload_too_large"
        | "auth_required"
        | "forbidden_photo"
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
const FAST_STORAGE_CANDIDATE_LIMIT = 80;
const FAST_STORAGE_CANDIDATE_PROBE_LIMIT = 12;
const TIERED_CANDIDATE_LIMIT = 240;
const TRANSIENT_DELIVERY_SIGNED_URL_SECONDS = 10 * 60;
const exchangeRateLimitBuckets = new Map<string, RateLimitBucket>();
type FastCandidateMode = "admin_storage" | "tiered";

export async function POST(request: Request) {
  try {
    return await handleExchangePost(request);
  } catch (error) {
    console.error("[sleeping-delivery/exchange] unhandled error", error);
    return NextResponse.json(
      { photo: null, source: "none", error: "exchange_failed" },
      { status: 500 },
    );
  }
}

async function handleExchangePost(request: Request) {
  const timing = createExchangeTiming();
  const parsedInput = await readExchangeRequest(request);
  markExchangeTiming(timing, "read_request");

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

  if (!isValidOwnPhotoInput(input)) {
    return NextResponse.json(
      { photo: null, source: "none", error: "invalid_exchange_request" },
      { status: 400 },
    );
  }

  const ownPhoto = input.ownPhoto;
  const createdAt = new Date(ownPhoto.createdAt ?? Date.now()).toISOString();
  const ownerCatId = ownPhoto.ownerCatId || ownPhoto.catId;
  const ownPhotoStoragePath = getStoragePhotoPath(ownPhoto.src);
  const shouldAddOwnPhotoToPool =
    !ownPhotoStoragePath && !isBlockedDeliveryPhotoUrl(ownPhoto.src);
  const debugDryRun =
    input.debugDryRun === true && process.env.NODE_ENV !== "production";
  const user = shouldAddOwnPhotoToPool || ownPhotoStoragePath
    ? await getAuthenticatedUserForRequest(request)
    : null;
  markExchangeTiming(timing, "auth");

  if (ownPhotoStoragePath) {
    // Storage-backed own photos are account-owned. Do not accept anonymousId
    // alone here; otherwise a forged anonymousId could send someone else's path.
    if (!isSafeStoragePath(ownPhotoStoragePath)) {
      return exchangeError("invalid_exchange_request", 400);
    }
    if (!user) {
      return exchangeError("auth_required", 401);
    }
    if (!isOwnStoragePath(ownPhotoStoragePath, user.id)) {
      return exchangeError("forbidden_photo", 403);
    }
  }

  const userId = user?.id ?? null;
  const anonymousId = userId ? null : input.anonymousId;
  const adminSupabase = createSupabaseAdminClient();
  const serverSupabase = adminSupabase ? null : await createServerSupabaseClient();
  const supabase = adminSupabase ?? serverSupabase;

  if (!userId && !anonymousId) {
    return NextResponse.json(
      { photo: null, source: "none", error: "invalid_exchange_request" },
      { status: 400 },
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { photo: null, source: "none", error: "server_unavailable" },
      { status: 503 },
    );
  }

  const deliveryDateValidation = await validateExchangeDeliveryDateKey({
    supabase,
    userId,
    anonymousId,
    deliveryDateKey: input.deliveryDateKey,
    mode: input.mode,
    debugDryRun,
  });

  if (!deliveryDateValidation.ok) {
    return NextResponse.json(
      {
        photo: null,
        source: "none",
        error: deliveryDateValidation.error,
        serverDateKey: deliveryDateValidation.serverDateKey,
      },
      { status: 422 },
    );
  }

  const idempotentDeliveryId =
    input.deliveryDateKey && !debugDryRun
      ? buildIdempotentDeliveryId({
          userId,
          anonymousId,
          deliveryDateKey: input.deliveryDateKey,
        })
      : null;

  if (idempotentDeliveryId) {
    const existingDelivery = await readExistingDelivery({
      supabase,
      userId,
      anonymousId,
      localDeliveryId: idempotentDeliveryId,
    });

    if (existingDelivery) {
      markExchangeTiming(timing, "read_existing_delivery");
      logExchangeTiming(timing, {
        result: "existing",
        deliveryDateKey: input.deliveryDateKey,
      });
      const existingPhoto = await attachTransientDeliverySignedUrl(
        toExchangePhotoFromDelivery(existingDelivery, input),
        supabase,
      );
      return NextResponse.json({
        photo: existingPhoto,
        source: "remote",
        diagnostics: {
          ...buildDiagnostics([], new Set(input.blockedPhotoIds ?? [])),
          source: "remote",
          candidateCount: 1,
          normalCandidateCount: 1,
          fallbackCandidateCount: 0,
          fallbackActive: false,
          excludedCount: 0,
          fastPathActive: false,
          fastCandidateCount: 0,
          idempotentReplay: true,
          tier: null,
          timing,
        },
        tier: null,
      });
    }
  }

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
  markExchangeTiming(timing, "own_photo");

  const blockedPhotoIds = new Set(input.blockedPhotoIds ?? []);
  const deliveredSourceMomentIds = await readDeliveredSourceMomentIds({
    supabase,
    userId,
    anonymousId,
  });
  markExchangeTiming(timing, "read_delivered_sources");
  const deliverableContext = {
    userId,
    anonymousId,
    recipientCatId: input.recipientCatId,
    excludePhotoId: ownPhoto.id,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  };

  const fastCandidateMode = readFastCandidateMode();
  const fastRows =
    fastCandidateMode === "admin_storage"
      ? await readFastStockCandidateRows(supabase)
      : [];
  markExchangeTiming(timing, "read_fast_storage");
  const fastCandidates = fastRows.filter((row) =>
    isFastStockCandidateDeliverable(row, deliverableContext),
  );
  let diagnosticsBase = buildDiagnostics([], blockedPhotoIds);
  let candidates: RemoteCatMomentRow[] = [];
  let fallbackCandidates: RemoteCatMomentRow[] = [];
  let candidatePool: RemoteCatMomentRow[] = [];
  let selected =
    fastCandidateMode === "admin_storage"
      ? await selectFastStorageCandidate(
          fastCandidates,
          input,
          supabase,
          deliverableContext,
        )
      : null;
  let fastPathActive = Boolean(selected);
  markExchangeTiming(timing, "select_fast_storage");

  if (!selected) {
    const remoteRows = await readRemoteCandidateRows(supabase);
    markExchangeTiming(timing, "read_full_pool");
    diagnosticsBase = buildDiagnostics(remoteRows, blockedPhotoIds);
    const tieredRows = sortTieredCandidates(
      remoteRows.filter((row) => isRowDeliverable(row, deliverableContext)),
      input,
    );
    candidates = tieredRows.filter((row) => getDeliveryTier(row, input) < 3);
    fallbackCandidates = tieredRows.filter(
      (row) => getDeliveryTier(row, input) === 3,
    );
    candidatePool = tieredRows;
    selected = await selectCandidate(candidatePool, input, supabase);
    fastPathActive = false;
    markExchangeTiming(timing, "select_full_pool");
  } else {
    diagnosticsBase = buildDiagnostics([selected.row], blockedPhotoIds);
    candidates = [selected.row];
    candidatePool = [selected.row];
  }

  if (!selected) {
    logExchangeTiming(timing, {
      result: "none",
      fastPathActive,
      fastCandidateCount: fastCandidates.length,
      candidateCount: candidatePool.length,
    });
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
        duplicateExcludedCount: deliveredSourceMomentIds.size,
        fastPathActive,
        fastCandidateCount: fastCandidates.length,
        timing,
      },
    });
  }

  const localDeliveryId =
    idempotentDeliveryId ??
    `delivered-sleeping-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const deliveredAt = new Date();
  const deliveryPhotoSrc = await prepareExchangeDeliveryPhotoSrc({
    supabase,
    row: selected.row,
    resolvedSrc: selected.src,
    canUseStorage: Boolean(adminSupabase),
  });
  markExchangeTiming(timing, "delivery_photo");
  const photo: ExchangePhoto = {
    id: localDeliveryId,
    sourcePhotoId: selected.row.local_moment_id,
    src: deliveryPhotoSrc,
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
        photo_url: deliveryPhotoSrc,
        status: "delivered",
        metadata: {
          source: "server_exchange",
          source_pool_kind: readPoolKind(selected.row.metadata),
          trigger_label: input.triggerLabel,
          theme: input.theme,
          category: input.category,
          delivery_date_key: input.deliveryDateKey,
          delivery_tier: selected.tier,
        },
        delivered_at: deliveredAt.toISOString(),
      });

    if (deliveryError) {
      if (idempotentDeliveryId && isUniqueDeliveryError(deliveryError)) {
        const existingDelivery = await readExistingDelivery({
          supabase,
          userId,
          anonymousId,
          localDeliveryId: idempotentDeliveryId,
        });

        if (existingDelivery) {
          markExchangeTiming(timing, "read_duplicate_delivery");
          logExchangeTiming(timing, {
            result: "existing_after_duplicate",
            deliveryDateKey: input.deliveryDateKey,
          });
          const existingPhoto = await attachTransientDeliverySignedUrl(
            toExchangePhotoFromDelivery(existingDelivery, input),
            supabase,
          );
          return NextResponse.json({
            photo: existingPhoto,
            source: "remote",
            diagnostics: {
              ...diagnosticsBase,
              source: "remote",
              candidateCount: candidatePool.length,
              normalCandidateCount: candidates.length,
              fallbackCandidateCount: fallbackCandidates.length,
              fallbackActive:
                candidates.length === 0 && fallbackCandidates.length > 0,
              excludedCount: Math.max(
                0,
                diagnosticsBase.availableCount - candidatePool.length,
              ),
              duplicateExcludedCount: deliveredSourceMomentIds.size,
              fastPathActive,
              fastCandidateCount: fastCandidates.length,
              idempotentReplay: true,
              tier: selected.tier,
              timing,
            },
            tier: selected.tier,
          });
        }
      }

      return NextResponse.json(
        { photo: null, source: "none", error: deliveryError.message },
        { status: 500 },
      );
    }

    await incrementDeliveryCount({
      supabase,
      row: selected.row,
    });
  }
  markExchangeTiming(timing, "insert_delivery");
  logExchangeTiming(timing, {
    result: "remote",
    fastPathActive,
    fastCandidateCount: fastCandidates.length,
    candidateCount: candidatePool.length,
    selectedStorage: Boolean(getStoragePhotoPath(selected.row.photo_url)),
    tier: selected.tier,
  });

  return NextResponse.json({
    photo: await attachTransientDeliverySignedUrl(photo, supabase),
    source: "remote",
    tier: selected.tier,
    diagnostics: {
      ...diagnosticsBase,
      source: "remote",
      candidateCount: candidatePool.length,
      normalCandidateCount: candidates.length,
      fallbackCandidateCount: fallbackCandidates.length,
      fallbackActive: candidates.length === 0 && fallbackCandidates.length > 0,
      excludedCount: Math.max(0, diagnosticsBase.availableCount - candidatePool.length),
      duplicateExcludedCount: deliveredSourceMomentIds.size,
      fastPathActive,
      fastCandidateCount: fastCandidates.length,
      tier: selected.tier,
      timing,
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
      deliveryDateKey: toStringOrNull(body.deliveryDateKey),
      recipientCatId: toStringOrNull(body.recipientCatId),
      anonymousId: toStringOrNull(body.anonymousId),
      blockedPhotoIds: Array.isArray(body.blockedPhotoIds)
        ? body.blockedPhotoIds.filter((id) => typeof id === "string")
        : [],
      preferredSourcePhotoId: toStringOrNull(body.preferredSourcePhotoId),
      debugDryRun: body.debugDryRun === true,
      mode: body.mode === "onboarding" ? "onboarding" : null,
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
    input.deliveryDateKey,
    input.mode,
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
    input.deliveryDateKey &&
    !isServerDateKey(input.deliveryDateKey)
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
  const storagePath = getStoragePhotoPath(src);

  if (storagePath !== null) {
    return validateOwnPhotoStoragePath(storagePath);
  }

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

function validateOwnPhotoStoragePath(path: string): ExchangeValidationResult {
  if (
    !path ||
    path.length > 512 ||
    path.includes("\\") ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
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

function exchangeError(error: string, status: 400 | 401 | 403 | 413 | 415 | 429) {
  return NextResponse.json({ photo: null, source: "none", error }, { status });
}

async function validateExchangeDeliveryDateKey({
  supabase,
  userId,
  anonymousId,
  deliveryDateKey,
  mode,
  debugDryRun,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  deliveryDateKey: string | null;
  mode: "onboarding" | null;
  debugDryRun: boolean;
}) {
  const serverDateKey = getServerJstDateKey();

  if (debugDryRun) {
    return { ok: true as const };
  }

  const canUseOnboardingException =
    mode === "onboarding" &&
    (await hasNoPriorDeliveries({ supabase, userId, anonymousId }));

  if (canUseOnboardingException) {
    return { ok: true as const };
  }

  if (!deliveryDateKey) {
    return {
      ok: false as const,
      error: "delivery_not_yet" as const,
      serverDateKey,
    };
  }

  return validateServerDeliveryDateKey({ deliveryDateKey });
}

async function hasNoPriorDeliveries({
  supabase,
  userId,
  anonymousId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
}) {
  let query = supabase
    .from("cat_moment_deliveries")
    .select("id", { count: "exact", head: true });

  query = userId
    ? query.eq("user_id", userId)
    : query.is("user_id", null).eq("anonymous_id", anonymousId ?? "");

  const { count, error } = await query;

  if (error) {
    console.warn("[sleeping-delivery/exchange] onboarding delivery count failed", {
      code: error.code,
    });
    return false;
  }

  return (count ?? 0) === 0;
}

function buildIdempotentDeliveryId({
  userId,
  anonymousId,
  deliveryDateKey,
}: {
  userId: string | null;
  anonymousId: string | null;
  deliveryDateKey: string;
}) {
  const recipientIdentity = userId ? `user:${userId}` : `anon:${anonymousId ?? ""}`;
  const digest = hashText(`${recipientIdentity}:${deliveryDateKey}`).toString(36);

  return `delivered-sleeping-${deliveryDateKey}-${digest}`;
}

async function readExistingDelivery({
  supabase,
  userId,
  anonymousId,
  localDeliveryId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  localDeliveryId: string;
}) {
  let query = supabase
    .from("cat_moment_deliveries")
    .select(
      "id, local_delivery_id, source_moment_id, source_photo_id, recipient_local_cat_id, photo_url, status, metadata, delivered_at",
    )
    .eq("local_delivery_id", localDeliveryId)
    .limit(1);

  query = userId
    ? query.eq("user_id", userId)
    : query.eq("anonymous_id", anonymousId ?? "").is("user_id", null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn("[sleeping-delivery/exchange] existing delivery lookup failed", {
      code: error.code,
    });
    return null;
  }

  return data as RemoteDeliveryRow | null;
}

async function readDeliveredSourceMomentIds({
  supabase,
  userId,
  anonymousId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
}) {
  let query = supabase
    .from("cat_moment_deliveries")
    .select("source_moment_id")
    .not("source_moment_id", "is", null)
    .limit(1000);

  query = userId
    ? query.eq("user_id", userId)
    : query.is("user_id", null).eq("anonymous_id", anonymousId ?? "");

  const { data, error } = await query;

  if (error) {
    console.warn("[sleeping-delivery/exchange] delivered source lookup failed", {
      code: error.code,
    });
    return new Set<string>();
  }

  return new Set(
    (data ?? [])
      .map((row) =>
        typeof row.source_moment_id === "string" ? row.source_moment_id : null,
      )
      .filter((value): value is string => Boolean(value)),
  );
}

function toExchangePhotoFromDelivery(
  delivery: RemoteDeliveryRow,
  input: Required<ExchangeRequest>,
): ExchangePhoto {
  const metadata = delivery.metadata ?? {};
  const triggerLabel =
    typeof metadata.trigger_label === "string"
      ? metadata.trigger_label
      : input.triggerLabel;
  const theme = typeof metadata.theme === "string" ? metadata.theme : input.theme;
  const deliveredAt = Date.parse(delivery.delivered_at);

  return {
    id: delivery.local_delivery_id,
    sourcePhotoId: delivery.source_photo_id ?? delivery.source_moment_id ?? "",
    src: delivery.photo_url,
    title: "縺ｻ縺九・迪ｫ縺ｮ縺ｭ縺後♀",
    subtitle: "",
    triggerLabel,
    theme,
    deliveredAt: Number.isFinite(deliveredAt) ? deliveredAt : Date.now(),
  };
}

async function attachTransientDeliverySignedUrl(
  photo: ExchangePhoto,
  supabase: SupabaseClient,
) {
  const storagePath = getStoragePhotoPath(photo.src);

  if (!storagePath) {
    return photo;
  }

  const signedUrl = await createTransientDeliverySignedUrl(supabase, storagePath);

  if (!signedUrl) {
    return photo;
  }

  return {
    ...photo,
    thumbnailSrc: signedUrl,
    displaySrc: signedUrl,
    originalSrc: signedUrl,
  };
}

async function createTransientDeliverySignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
) {
  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, TRANSIENT_DELIVERY_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

function isUniqueDeliveryError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    /cat_moment_deliveries_(?:user|anonymous)_local_delivery_uidx/i.test(
      error.message ?? "",
    )
  );
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
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, delivery_status, moderation_status, pool_date, delivery_count, metadata, created_at",
    )
    .eq("visibility", "shared")
    .eq("delivery_status", "available")
    .eq("moderation_status", "approved")
    .order("delivery_count", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(TIERED_CANDIDATE_LIMIT);

  return (data ?? []) as RemoteCatMomentRow[];
}

async function readFastStockCandidateRows(
  supabase: SupabaseClient,
) {
  const mode = readFastCandidateMode();

  if (mode !== "admin_storage") {
    return [];
  }

  const { data } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, delivery_status, moderation_status, pool_date, delivery_count, metadata, created_at",
    )
    .eq("visibility", "shared")
    .eq("delivery_status", "available")
    .eq("moderation_status", "approved")
    .like("local_moment_id", "stock-sleeping-%")
    .order("created_at", { ascending: false })
    .limit(FAST_STORAGE_CANDIDATE_LIMIT);

  return (data ?? []) as FastStockCandidateRow[];
}

function readFastCandidateMode(): FastCandidateMode {
  const raw = process.env.SLEEPING_DELIVERY_FAST_CANDIDATES;

  if (raw === "admin_storage") {
    return "admin_storage";
  }

  return "tiered";
}

function isFastStockCandidateDeliverable(
  row: FastStockCandidateRow,
  {
    userId,
    anonymousId,
    recipientCatId,
    excludePhotoId,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  }: {
    userId: string | null;
    anonymousId: string | null;
    recipientCatId: string | null;
    excludePhotoId: string;
    blockedPhotoIds: Set<string>;
    deliveredSourceMomentIds: Set<string>;
  },
) {
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
  if (
    deliveredSourceMomentIds.has(row.id) ||
    deliveredSourceMomentIds.has(row.local_moment_id)
  ) {
    return false;
  }

  return !blockedPhotoIds.has(row.id) && !blockedPhotoIds.has(row.local_moment_id);
}

function isRowDeliverable(
  row: RemoteCatMomentRow,
  {
    userId,
    anonymousId,
    recipientCatId,
    excludePhotoId,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  }: {
    userId: string | null;
    anonymousId: string | null;
    recipientCatId: string | null;
    excludePhotoId: string;
    blockedPhotoIds: Set<string>;
    deliveredSourceMomentIds: Set<string>;
  },
) {
  if (isBlockedDeliveryPoolRow(row)) {
    return false;
  }
  if (row.moderation_status !== "approved") {
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
  if (
    deliveredSourceMomentIds.has(row.id) ||
    deliveredSourceMomentIds.has(row.local_moment_id)
  ) {
    return false;
  }

  return !blockedPhotoIds.has(row.id) && !blockedPhotoIds.has(row.local_moment_id);
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

async function prepareExchangeDeliveryPhotoSrc({
  supabase,
  row,
  resolvedSrc,
  canUseStorage,
}: {
  supabase: SupabaseClient;
  row: RemoteCatMomentRow;
  resolvedSrc: string;
  canUseStorage: boolean;
}) {
  if (getStoragePhotoPath(row.photo_url)) {
    return row.photo_url;
  }

  if (!row.photo_url.startsWith("data:image/") || !canUseStorage) {
    return resolvedSrc;
  }

  try {
    const storagePath = await uploadDataUrl(
      supabase,
      `delivery-cache/${sanitizePathSegment(row.local_moment_id)}.${getDataUrlExtension(
        row.photo_url,
      )}`,
      row.photo_url,
    );

    return toStoragePhotoUrl(storagePath);
  } catch {
    return resolvedSrc;
  }
}

async function incrementDeliveryCount({
  supabase,
  row,
}: {
  supabase: SupabaseClient;
  row: RemoteCatMomentRow;
}) {
  const nextDeliveryCount = Math.max(0, row.delivery_count ?? 0) + 1;
  const { error } = await supabase
    .from("cat_moments")
    .update({ delivery_count: nextDeliveryCount })
    .eq("id", row.id);

  if (error) {
    console.warn("[sleeping-delivery/exchange] delivery_count update failed", {
      code: error.code,
    });
  }
}

function sortTieredCandidates(
  rows: RemoteCatMomentRow[],
  input: Required<ExchangeRequest>,
) {
  return [...rows].sort((a, b) => {
    const tierDelta = getDeliveryTier(a, input) - getDeliveryTier(b, input);

    if (tierDelta !== 0) {
      return tierDelta;
    }

    const countDelta = (a.delivery_count ?? 0) - (b.delivery_count ?? 0);

    if (countDelta !== 0) {
      return countDelta;
    }

    return (
      hashText(`${input.seed}:${a.id}:${a.local_moment_id}`) -
      hashText(`${input.seed}:${b.id}:${b.local_moment_id}`)
    );
  });
}

function getDeliveryTier(
  row: RemoteCatMomentRow,
  input: Required<ExchangeRequest>,
): DeliveryTier {
  if (readPoolKind(row.metadata) === "admin_stock") {
    return 3;
  }

  return input.deliveryDateKey && row.pool_date === input.deliveryDateKey ? 1 : 2;
}

async function selectCandidate(
  rows: RemoteCatMomentRow[],
  input: Required<ExchangeRequest>,
  supabase: SupabaseClient,
) {
  if (rows.length === 0) {
    return null;
  }

  if (input.preferredSourcePhotoId) {
    const preferredRow = rows.find(
      (row) =>
        row.id === input.preferredSourcePhotoId ||
        row.local_moment_id === input.preferredSourcePhotoId,
    );

    const preferredCandidate = preferredRow
      ? await toResolvedCandidate(preferredRow, supabase, getDeliveryTier(preferredRow, input))
      : null;

    if (preferredCandidate) {
      return preferredCandidate;
    }
  }

  const startIndex =
    hashText(`${input.seed}:${input.triggerLabel}:${input.theme}`) %
    rows.length;

  for (let offset = 0; offset < rows.length; offset += 1) {
    const row = rows[(startIndex + offset) % rows.length];
    const candidate = await toResolvedCandidate(row, supabase, getDeliveryTier(row, input));

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function selectFastStorageCandidate(
  rows: FastStockCandidateRow[],
  input: Required<ExchangeRequest>,
  supabase: SupabaseClient,
  deliverableContext: Parameters<typeof isRowDeliverable>[1],
) {
  if (rows.length === 0) {
    return null;
  }

  if (input.preferredSourcePhotoId) {
    const preferredRow = rows.find(
      (row) =>
        row.id === input.preferredSourcePhotoId ||
        row.local_moment_id === input.preferredSourcePhotoId,
    );
    const preferredCandidate = preferredRow
      ? await fetchFastStorageCandidate(preferredRow, supabase, deliverableContext)
      : null;

    if (preferredCandidate) {
      return preferredCandidate;
    }
  }

  const startIndex =
    hashText(`${input.seed}:${input.triggerLabel}:${input.theme}`) %
    rows.length;
  const probeCount = Math.min(rows.length, FAST_STORAGE_CANDIDATE_PROBE_LIMIT);

  for (let offset = 0; offset < probeCount; offset += 1) {
    const row = rows[(startIndex + offset) % rows.length];
    const candidate = await fetchFastStorageCandidate(
      row,
      supabase,
      deliverableContext,
    );

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function fetchFastStorageCandidate(
  row: FastStockCandidateRow,
  supabase: SupabaseClient,
  deliverableContext: Parameters<typeof isRowDeliverable>[1],
) {
  const { data } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, delivery_status, moderation_status, pool_date, delivery_count, metadata, created_at",
    )
    .eq("id", row.id)
    .maybeSingle();
  const fullRow = data as RemoteCatMomentRow | null;

  if (
    !fullRow ||
    !getStoragePhotoPath(fullRow.photo_url) ||
    !isRowDeliverable(fullRow, deliverableContext)
  ) {
    return null;
  }

  return toResolvedCandidate(fullRow, supabase, 3);
}

async function toResolvedCandidate(
  row: RemoteCatMomentRow,
  supabase: SupabaseClient,
  tier: DeliveryTier,
): Promise<Candidate | null> {
  if (getStoragePhotoPath(row.photo_url)) {
    return {
      row,
      src: row.photo_url,
      tags: readTags(row.metadata),
      tier,
    };
  }

  const src = await resolvePhotoUrl(row.photo_url, supabase);

  if (!src || !isUsablePhotoSrc(src)) {
    return null;
  }

  return {
    row,
    src,
    tags: readTags(row.metadata),
    tier,
  };
}

function buildDiagnostics(
  rows: RemoteCatMomentRow[],
  blockedPhotoIds: Set<string>,
) {
  const availableRows = rows.filter((row) => row.delivery_status === "available");
  const usableAvailableRows = availableRows.filter((row) =>
    isUsablePhotoSrc(row.photo_url),
  );
  const approvedRows = rows.filter((row) => row.moderation_status === "approved");
  const pendingRows = rows.filter((row) => row.moderation_status === "pending");
  const rejectedRows = rows.filter((row) => row.moderation_status === "rejected");
  const tier1Rows = usableAvailableRows.filter(
    (row) => readPoolKind(row.metadata) !== "admin_stock" && row.pool_date,
  );
  const tier3Rows = usableAvailableRows.filter(
    (row) => readPoolKind(row.metadata) === "admin_stock",
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
    moderationPendingCount: pendingRows.length,
    moderationApprovedCount: approvedRows.length,
    moderationRejectedCount: rejectedRows.length,
    tier1CandidateCount: tier1Rows.length,
    tier2CandidateCount: Math.max(
      0,
      usableAvailableRows.length - tier1Rows.length - tier3Rows.length,
    ),
    tier3CandidateCount: tier3Rows.length,
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

function createExchangeTiming() {
  return {
    startedAt: Date.now(),
    marks: [] as { label: string; elapsedMs: number }[],
  };
}

function markExchangeTiming(
  timing: ReturnType<typeof createExchangeTiming>,
  label: string,
) {
  timing.marks.push({ label, elapsedMs: Date.now() - timing.startedAt });
}

function logExchangeTiming(
  timing: ReturnType<typeof createExchangeTiming>,
  details: Record<string, unknown>,
) {
  console.info("[sleeping-delivery/exchange] timing", {
    ...details,
    totalMs: Date.now() - timing.startedAt,
    marks: timing.marks,
  });
}

function toStringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
