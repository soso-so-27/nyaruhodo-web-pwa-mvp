import { NextResponse } from "next/server";

import {
  CAT_PHOTOS_BUCKET,
  getDataUrlExtension,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "../../../../../lib/photoStorage";
import { validateOwnPhotoSrc } from "../../../../../lib/home/sleepingDeliveryRequestGuards";
import { authorizeAdminTaskRequest } from "../../../../../lib/server/adminTaskAuth";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
const DEFAULT_SCAN_LIMIT = 250;
const MAX_SCAN_LIMIT = 250;

type BackfillRequest = {
  limit?: unknown;
  scanLimit?: unknown;
};

type CatMomentDataUrlRow = {
  id: string;
  photo_url: string;
};

export async function POST(request: Request) {
  const unauthorized = authorizeAdminTaskRequest(request);
  if (unauthorized) {
    return unauthorized;
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "admin_unavailable" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as BackfillRequest | null;
  const limit = normalizeLimit(body?.limit);
  const scanLimit = normalizeScanLimit(body?.scanLimit);
  const { data, error } = await supabase
    .from("cat_moments")
    .select("id, photo_url")
    .like("photo_url", "data:%")
    .order("created_at", { ascending: true })
    .limit(scanLimit);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "cat_moment_lookup_failed" },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as CatMomentDataUrlRow[];
  let updated = 0;
  let skipped = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  for (const row of rows) {
    if (updated >= limit) {
      break;
    }

    const validation = validateOwnPhotoSrc(row.photo_url);
    if (!validation.ok) {
      skipped += 1;
      failures.push({ id: row.id, reason: validation.error });
      continue;
    }

    const storagePath = `anonymous/migrated/${sanitizePathSegment(
      row.id,
    )}.${getDataUrlExtension(row.photo_url)}`;

    try {
      await uploadDataUrl(supabase, storagePath, row.photo_url);
    } catch (uploadError) {
      skipped += 1;
      failures.push({
        id: row.id,
        reason:
          uploadError instanceof Error
            ? uploadError.message.slice(0, 120)
            : "upload_failed",
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("cat_moments")
      .update({ photo_url: toStoragePhotoUrl(storagePath) })
      .eq("id", row.id);

    if (updateError) {
      await supabase.storage.from(CAT_PHOTOS_BUCKET).remove([storagePath]);
      skipped += 1;
      failures.push({
        id: row.id,
        reason: `update_failed: ${updateError.message}`.slice(0, 160),
      });
      continue;
    }

    updated += 1;
  }

  const { count: remainingCatMomentDataUrlCount } = await supabase
    .from("cat_moments")
    .select("id", { count: "exact", head: true })
    .like("photo_url", "data:%");
  const { count: deliveryDataUrlCount } = await supabase
    .from("cat_moment_deliveries")
    .select("id", { count: "exact", head: true })
    .like("photo_url", "data:%");

  console.info("[admin/storage-hardening/backfill-cat-moments] completed", {
    scanned: rows.length,
    updateLimit: limit,
    scanLimit,
    updated,
    skipped,
    remainingCatMomentDataUrlCount,
    deliveryDataUrlCount,
  });

  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    updateLimit: limit,
    scanLimit,
    updated,
    skipped,
    remainingCatMomentDataUrlCount: remainingCatMomentDataUrlCount ?? null,
    deliveryDataUrlCount: deliveryDataUrlCount ?? null,
    failures: failures.slice(0, 20),
  });
}

function normalizeLimit(value: unknown) {
  const limit = Number(value);
  if (Number.isFinite(limit) && limit > 0) {
    return Math.min(MAX_LIMIT, Math.floor(limit));
  }

  return DEFAULT_LIMIT;
}

function normalizeScanLimit(value: unknown) {
  const limit = Number(value);
  if (Number.isFinite(limit) && limit > 0) {
    return Math.min(MAX_SCAN_LIMIT, Math.floor(limit));
  }

  return DEFAULT_SCAN_LIMIT;
}
