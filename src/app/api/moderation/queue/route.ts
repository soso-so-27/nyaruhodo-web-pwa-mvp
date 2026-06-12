import { NextResponse } from "next/server";

import { getAdminCapabilitiesForRequest } from "../../../../lib/adminAccess";
import {
  CAT_PHOTOS_BUCKET,
  getStoragePhotoPath,
} from "../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

type PendingMomentRow = {
  id: string;
  local_moment_id: string;
  local_cat_id: string;
  owner_cat_id: string;
  photo_url: string;
  moderation_status: string;
  delivery_status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function GET(request: Request) {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!capabilities.isAdmin) {
    return NextResponse.json({ moments: [] }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ moments: [] }, { status: 503 });
  }

  const { data, error, count } = await supabase
    .from("cat_moments")
    .select(
      "id, local_moment_id, local_cat_id, owner_cat_id, photo_url, moderation_status, delivery_status, metadata, created_at",
      { count: "exact" },
    )
    .eq("moderation_status", "pending")
    .eq("visibility", "shared")
    .eq("delivery_status", "available")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ moments: [], pendingCount: 0 }, { status: 200 });
  }

  const moments = await Promise.all(
    ((data ?? []) as PendingMomentRow[]).map(async (row) => ({
      id: row.id,
      localMomentId: row.local_moment_id,
      localCatId: row.local_cat_id,
      ownerCatId: row.owner_cat_id,
      photoSrc: await resolveModerationPhotoSrc(row.photo_url),
      moderationStatus: row.moderation_status,
      deliveryStatus: row.delivery_status,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    })),
  );

  return NextResponse.json({ moments, pendingCount: count ?? moments.length });
}

async function resolveModerationPhotoSrc(photoUrl: string) {
  const storagePath = getStoragePhotoPath(photoUrl);

  if (!storagePath) {
    return photoUrl.startsWith("data:image/") ? photoUrl : null;
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
