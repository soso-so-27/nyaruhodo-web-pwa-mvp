import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getDataUrlExtension,
  isUsablePhotoSrc,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "../../../../lib/photoStorage";
import { requireStockAdminAccess } from "../../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import type { ExchangePhotoPoolItem } from "../../../../lib/home/sleepingPhotos";

export const dynamic = "force-dynamic";

type StockRequest = {
  src?: string;
};

export async function POST(request: Request) {
  const adminAccess = await requireStockAdminAccess(request);

  if (!adminAccess.allowed) {
    return NextResponse.json(
      { photo: null, error: adminAccess.error },
      { status: adminAccess.status },
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const supabase = adminSupabase ?? (await createServerSupabaseClient());
  const body = (await request.json().catch(() => null)) as StockRequest | null;
  const src = typeof body?.src === "string" ? body.src : "";

  if (!supabase) {
    return NextResponse.json(
      { photo: null, error: "server_stock_unavailable" },
      { status: 503 },
    );
  }

  if (!isSupportedPhotoSrc(src)) {
    return NextResponse.json(
      { photo: null, error: "invalid_photo" },
      { status: 400 },
    );
  }

  const createdAt = Date.now();
  const localMomentId = `stock-sleeping-${createdAt}-${Math.random()
    .toString(16)
    .slice(2)}`;
  const photoUrl = await prepareStockPhotoUrl({
    supabase,
    localMomentId,
    src,
    canUseStorage: Boolean(adminSupabase),
  });
  const photo: ExchangePhotoPoolItem = {
    id: `remote-stock-${localMomentId}`,
    sourceOwnPhotoId: localMomentId,
    sourceCatId: "admin-stock",
    src: photoUrl,
    title: "ほかの猫のねがお",
    subtitle: "",
    tags: ["sleeping", "ねてる"],
  };
  const { error } = await supabase.from("cat_moments").insert({
    user_id: null,
    anonymous_id: "admin-stock",
    local_moment_id: localMomentId,
    local_cat_id: "admin-stock",
    owner_cat_id: "admin-stock",
    photo_url: photoUrl,
    state: "sleeping",
    visibility: "shared",
    delivery_status: "available",
    moderation_status: "approved",
    moderated_at: new Date(createdAt).toISOString(),
    moderated_by: adminAccess.user.email ?? adminAccess.user.id,
    source_moment_id: null,
    metadata: {
      source: "admin-stock",
      pool_kind: "admin_stock",
      trigger_label: "ねがお",
      theme: "sleeping",
      shared: true,
    },
    captured_at: new Date(createdAt).toISOString(),
    created_at: new Date(createdAt).toISOString(),
  });

  if (error) {
    return NextResponse.json(
      { photo: null, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ photo });
}

function isSupportedPhotoSrc(src: string) {
  return isUsablePhotoSrc(src);
}

async function prepareStockPhotoUrl({
  supabase,
  localMomentId,
  src,
  canUseStorage,
}: {
  supabase: SupabaseClient;
  localMomentId: string;
  src: string;
  canUseStorage: boolean;
}) {
  if (!src.startsWith("data:image/") || !canUseStorage) {
    return src;
  }

  try {
    const storagePath = await uploadDataUrl(
      supabase,
      `admin-stock/sleeping/${sanitizePathSegment(localMomentId)}.${getDataUrlExtension(src)}`,
      src,
    );

    return toStoragePhotoUrl(storagePath);
  } catch {
    return src;
  }
}
