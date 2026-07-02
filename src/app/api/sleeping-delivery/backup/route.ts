import { NextResponse } from "next/server";

import {
  getDataUrlExtension,
  isUsablePhotoSrc,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import {
  ownSleepingPhotoToCatMoment,
  toCatMomentRecord,
  type OwnSleepingPhoto,
} from "../../../../lib/home/sleepingPhotos";

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

  const serverSupabase = await createServerSupabaseClient();
  const { data } = serverSupabase
    ? await serverSupabase.auth.getUser().catch(() => ({ data: { user: null } }))
    : { data: { user: null } };
  const userId = data.user?.id ?? null;
  const anonymousId = userId ? null : normalizeAnonymousId(body?.anonymousId);

  if (!userId && !anonymousId) {
    return NextResponse.json(
      { ok: false, error: "missing_identity" },
      { status: 400 },
    );
  }

  const moment = ownSleepingPhotoToCatMoment(photo);
  const record = toCatMomentRecord(moment);
  const photoUrl =
    userId && record.photo_url.startsWith("data:")
      ? toStoragePhotoUrl(
          await uploadDataUrl(
            adminSupabase,
            `${userId}/${sanitizePathSegment(photo.ownerCatId)}/sleeping/${sanitizePathSegment(
              record.id,
            )}.${getDataUrlExtension(record.photo_url)}`,
            record.photo_url,
          ),
        )
      : record.photo_url;

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
    visibility: record.visibility,
    delivery_status: record.delivery_status,
    source_moment_id: record.source_moment_id,
    metadata: {
      trigger_label: photo.triggerLabel,
      theme: photo.theme,
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
    visibility: photo.visibility === "private" ? "private" : "shared",
    deliveryStatus:
      photo.deliveryStatus === "hidden" || photo.deliveryStatus === "reported"
        ? photo.deliveryStatus
        : "available",
    triggerLabel:
      typeof photo.triggerLabel === "string" ? photo.triggerLabel : "ねがお",
    theme: typeof photo.theme === "string" ? photo.theme : "sleeping",
    shared:
      typeof photo.shared === "boolean"
        ? photo.shared
        : photo.visibility === "shared",
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
