import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  getDataUrlExtension,
  getStoragePhotoPath,
  isUsablePhotoSrc,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import {
  ownSleepingPhotoToCatMoment,
  toCatMomentRecord,
  type OwnSleepingPhoto,
} from "../../../../lib/home/sleepingPhotos";
import {
  buildSleepingDeliveryRateLimitKey,
  checkExchangeRateLimit,
  validateOwnPhotoSrc,
  validateOwnStoragePhotoPathAccess,
} from "../../../../lib/home/sleepingDeliveryRequestGuards";

export const dynamic = "force-dynamic";

type BackupRequest = {
  anonymousId?: string | null;
  photo?: Partial<OwnSleepingPhoto> | null;
};

export async function POST(request: Request) {
  const adminSupabase = createSupabaseAdminClient();

  if (!adminSupabase) {
    return NextResponse.json(
      { ok: false, error: "backup_unavailable" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as BackupRequest | null;
  const photo = normalizeBackupPhoto(body?.photo);

  if (!photo) {
    return NextResponse.json(
      { ok: false, error: "invalid_photo" },
      { status: 400 },
    );
  }

  const data = await getRequestUser(request);
  const userId = data.user?.id ?? null;
  const anonymousId = userId ? null : normalizeAnonymousId(body?.anonymousId);

  if (!userId && !anonymousId) {
    return NextResponse.json(
      { ok: false, error: "missing_identity" },
      { status: 400 },
    );
  }

  const rateLimit = checkExchangeRateLimit(
    buildSleepingDeliveryRateLimitKey(request, anonymousId),
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "too_many_requests" },
      { status: 429 },
    );
  }

  const srcValidation = validateOwnPhotoSrc(photo.src);

  if (!srcValidation.ok) {
    return NextResponse.json(
      { ok: false, error: srcValidation.error },
      { status: srcValidation.status },
    );
  }

  const storagePath = getStoragePhotoPath(photo.src);

  if (storagePath) {
    const storageValidation = validateOwnStoragePhotoPathAccess(
      storagePath,
      userId,
    );

    if (!storageValidation.ok) {
      return NextResponse.json(
        { ok: false, error: storageValidation.error },
        { status: storageValidation.status },
      );
    }
  }

  const moment = ownSleepingPhotoToCatMoment(photo);
  const record = toCatMomentRecord(moment);
  const photoUrl = await persistBackupPhotoUrl({
    adminSupabase,
    userId,
    anonymousId,
    photo,
    recordId: record.id,
    photoUrl: record.photo_url,
  });

  if (userId) {
    const { error: deleteError } = await adminSupabase
      .from("cat_moments")
      .delete()
      .eq("user_id", userId)
      .eq("local_moment_id", record.id);

    if (deleteError) {
      return NextResponse.json(
        { ok: false, error: "backup_delete_failed" },
        { status: 500 },
      );
    }
  }

  const { error } = await adminSupabase.from("cat_moments").insert({
    user_id: userId,
    anonymous_id: anonymousId,
    local_moment_id: record.id,
    local_cat_id: photo.catId,
    owner_cat_id: record.owner_cat_id,
    photo_url: photoUrl,
    state: record.state,
    visibility: "shared",
    delivery_status: "available",
    moderation_status: "pending",
    source_moment_id: record.source_moment_id,
    metadata: {
      source: "user_backup",
      pool_kind: "user_shared",
      trigger_label: photo.triggerLabel,
      theme: photo.theme,
      shared: true,
    },
    captured_at: record.created_at,
    created_at: record.created_at,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "backup_insert_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

async function getRequestUser(request: Request) {
  const bearerToken = getBearerToken(request);
  const config = getSupabasePublicConfig();

  if (bearerToken && config) {
    const authSupabase = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data } = await authSupabase.auth
      .getUser(bearerToken)
      .catch(() => ({ data: { user: null } }));
    return data;
  }

  const serverSupabase = await createServerSupabaseClient();
  const { data } = serverSupabase
    ? await serverSupabase.auth.getUser().catch(() => ({ data: { user: null } }))
    : { data: { user: null } };

  return data;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

function normalizeBackupPhoto(
  photo: Partial<OwnSleepingPhoto> | null | undefined,
): OwnSleepingPhoto | null {
  if (
    !photo ||
    typeof photo.id !== "string" ||
    typeof photo.src !== "string" ||
    !isUsablePhotoSrc(photo.src)
  ) {
    return null;
  }

  const ownerCatId =
    typeof photo.ownerCatId === "string"
      ? photo.ownerCatId
      : typeof photo.catId === "string"
        ? photo.catId
        : null;

  if (!ownerCatId) {
    return null;
  }

  return {
    id: photo.id,
    ownerCatId,
    catId: typeof photo.catId === "string" ? photo.catId : ownerCatId,
    src: photo.src,
    ...(typeof photo.thumbnailSrc === "string"
      ? { thumbnailSrc: photo.thumbnailSrc }
      : {}),
    ...(typeof photo.displaySrc === "string" ? { displaySrc: photo.displaySrc } : {}),
    ...(typeof photo.originalSrc === "string"
      ? { originalSrc: photo.originalSrc }
      : {}),
    state: photo.state === "sleeping" ? photo.state : "sleeping",
    visibility: "shared",
    deliveryStatus: "available",
    triggerLabel:
      typeof photo.triggerLabel === "string" ? photo.triggerLabel : "ねがお",
    theme: typeof photo.theme === "string" ? photo.theme : "sleeping",
    shared: true,
    createdAt:
      typeof photo.createdAt === "number" && Number.isFinite(photo.createdAt)
        ? photo.createdAt
        : Date.now(),
    ...(typeof photo.sourceMomentId === "string"
      ? { sourceMomentId: photo.sourceMomentId }
      : {}),
  };
}

function normalizeAnonymousId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > 128) {
    return null;
  }

  return normalized;
}

async function persistBackupPhotoUrl({
  adminSupabase,
  userId,
  anonymousId,
  photo,
  recordId,
  photoUrl,
}: {
  adminSupabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  userId: string | null;
  anonymousId: string | null;
  photo: OwnSleepingPhoto;
  recordId: string;
  photoUrl: string;
}) {
  if (!photoUrl.startsWith("data:")) {
    return photoUrl;
  }

  const path = userId
    ? `${userId}/${sanitizePathSegment(photo.ownerCatId)}/sleeping/${sanitizePathSegment(
        recordId,
      )}.${getDataUrlExtension(photoUrl)}`
    : `anonymous/${sanitizePathSegment(
        anonymousId ?? "unattributed",
      )}/sleeping/${sanitizePathSegment(recordId)}.${getDataUrlExtension(photoUrl)}`;

  try {
    return toStoragePhotoUrl(await uploadDataUrl(adminSupabase, path, photoUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.warn("[sleeping-delivery/backup] storage upload failed", {
      hasUser: Boolean(userId),
      hasAnonymousId: Boolean(anonymousId),
      error: message,
    });
    await recordBackupStorageUploadFailure({
      adminSupabase,
      userId,
      anonymousId,
      error: message,
    });
    return photoUrl;
  }
}

async function recordBackupStorageUploadFailure({
  adminSupabase,
  userId,
  anonymousId,
  error,
}: {
  adminSupabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  userId: string | null;
  anonymousId: string | null;
  error: string;
}) {
  const { error: eventError } = await adminSupabase.from("app_events").insert({
    event_name: "sleeping_backup_storage_upload_failed",
    source: "unknown",
    user_id: userId,
    anonymous_id: userId ? null : anonymousId,
    route: "/api/sleeping-delivery/backup",
    metadata: {
      has_user: Boolean(userId),
      has_anonymous_id: Boolean(anonymousId),
      error: error.slice(0, 160),
    },
  });

  if (eventError) {
    console.warn("[sleeping-delivery/backup] upload failure trace failed", {
      code: eventError.code,
    });
  }
}
