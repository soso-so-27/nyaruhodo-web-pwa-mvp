import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import {
  getStoragePhotoPath,
  isUsablePhotoSrc,
} from "../../../../lib/photoStorage";
import type { ExchangePhotoPoolItem } from "../../../../lib/home/sleepingPhotos";

export const dynamic = "force-dynamic";

type CandidateRequest = {
  triggerLabel?: string;
  theme?: string;
  category?: string;
  seed?: string;
  excludePhotoId?: string;
  recipientCatId?: string | null;
  excludeUserId?: string | null;
  blockedPhotoIds?: string[];
};

type RemoteCatMomentRow = {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  local_moment_id: string;
  local_cat_id: string;
  owner_cat_id: string;
  photo_url: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type CandidateFilterContext = {
  excludeUserId?: string | null;
  recipientCatId?: string | null;
  excludePhotoId?: string;
  blockedIds: Set<string>;
};

export async function POST(request: Request) {
  const input = await readCandidateRequest(request);
  const remoteCandidates = await readRemoteCandidates(input);
  const selected = selectCandidate(remoteCandidates, input);

  return NextResponse.json({
    photo: selected,
    source: selected ? "remote" : "none",
  });
}

async function readCandidateRequest(request: Request): Promise<CandidateRequest> {
  try {
    const body = (await request.json()) as CandidateRequest;

    return {
      triggerLabel: toStringOrUndefined(body.triggerLabel),
      theme: toStringOrUndefined(body.theme) ?? "sleeping",
      category: toStringOrUndefined(body.category) ?? "sleeping",
      seed: toStringOrUndefined(body.seed) ?? String(Date.now()),
      excludePhotoId: toStringOrUndefined(body.excludePhotoId),
      recipientCatId: toStringOrNull(body.recipientCatId),
      excludeUserId: toStringOrNull(body.excludeUserId),
      blockedPhotoIds: Array.isArray(body.blockedPhotoIds)
        ? body.blockedPhotoIds.filter((id) => typeof id === "string")
        : [],
    };
  } catch {
    return { seed: String(Date.now()), theme: "sleeping", category: "sleeping" };
  }
}

async function readRemoteCandidates(input: CandidateRequest) {
  const supabase =
    createSupabaseAdminClient() ?? (await createServerSupabaseClient());

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, metadata, created_at",
    )
    .eq("visibility", "shared")
    .eq("delivery_status", "available")
    .order("created_at", { ascending: false })
    .limit(120);

  if (error || !data) {
    return [];
  }

  const blockedIds = new Set(input.blockedPhotoIds ?? []);
  const allRows = data as RemoteCatMomentRow[];
  const filterContext: CandidateFilterContext = {
    excludeUserId: input.excludeUserId,
    recipientCatId: input.recipientCatId,
    excludePhotoId: input.excludePhotoId,
    blockedIds,
  };
  const rows = allRows.filter((row) => isRowDeliverable(row, filterContext));
  const fallbackRows =
    rows.length === 0 && blockedIds.size > 0
      ? allRows.filter((row) =>
          isAdminStockFallbackDeliverable(row, filterContext),
        )
      : [];

  const candidates = await Promise.all(
    (rows.length > 0 ? rows : fallbackRows).map(
      async (row): Promise<ExchangePhotoPoolItem | null> => {
        const src = await resolvePhotoUrl(row.photo_url);

        if (!src || !isUsablePhotoSrc(src)) {
          return null;
        }

        return {
          id: `remote-${row.id}`,
          sourceOwnPhotoId: row.local_moment_id,
          sourceCatId: row.local_cat_id || row.owner_cat_id,
          src,
          title: "ほかの猫のねがお",
          subtitle: "",
          tags: readTags(row.metadata),
        };
      },
    ),
  );

  return candidates.filter(
    (candidate): candidate is ExchangePhotoPoolItem => Boolean(candidate),
  );
}

function isRowDeliverable(row: RemoteCatMomentRow, context: CandidateFilterContext) {
  if (!isUsablePhotoSrc(row.photo_url)) {
    return false;
  }
  if (context.excludeUserId && row.user_id === context.excludeUserId) {
    return false;
  }
  if (
    context.recipientCatId &&
    (row.local_cat_id === context.recipientCatId ||
      row.owner_cat_id === context.recipientCatId)
  ) {
    return false;
  }
  if (
    context.excludePhotoId &&
    (row.id === context.excludePhotoId ||
      row.local_moment_id === context.excludePhotoId)
  ) {
    return false;
  }

  return !context.blockedIds.has(row.id) && !context.blockedIds.has(row.local_moment_id);
}

function isAdminStockFallbackDeliverable(
  row: RemoteCatMomentRow,
  context: CandidateFilterContext,
) {
  if (readPoolKind(row.metadata) !== "admin_stock") {
    return false;
  }

  return isRowDeliverable(row, {
    ...context,
    blockedIds: new Set<string>(),
  });
}

async function resolvePhotoUrl(photoUrl: string) {
  const storagePath = getStoragePhotoPath(photoUrl);

  if (!storagePath) {
    return photoUrl;
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return photoUrl;
  }

  const { data, error } = await supabase.storage
    .from("cat-photos")
    .createSignedUrl(storagePath, 60 * 60 * 24);

  if (error || !data?.signedUrl) {
    return photoUrl;
  }

  return data.signedUrl;
}

function selectCandidate(
  candidates: ExchangePhotoPoolItem[],
  input: CandidateRequest,
) {
  const available = candidates.filter((candidate) =>
    isCandidateAvailable(candidate, input),
  );

  if (available.length === 0) {
    return null;
  }

  const index = hashText(
    `${input.seed ?? ""}:${input.triggerLabel ?? ""}:${input.theme ?? ""}`,
  ) % available.length;

  return available[index];
}

function isCandidateAvailable(
  photo: ExchangePhotoPoolItem,
  input: CandidateRequest,
) {
  const blockedIds = new Set(input.blockedPhotoIds ?? []);

  return (
    (!input.excludePhotoId ||
      (photo.id !== input.excludePhotoId &&
        photo.sourceOwnPhotoId !== input.excludePhotoId)) &&
    (!input.recipientCatId || photo.sourceCatId !== input.recipientCatId) &&
    !blockedIds.has(photo.id) &&
    !(photo.sourceOwnPhotoId && blockedIds.has(photo.sourceOwnPhotoId))
  );
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

function toStringOrUndefined(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
