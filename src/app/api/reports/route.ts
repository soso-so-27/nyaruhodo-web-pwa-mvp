import { NextResponse } from "next/server";

import {
  getAdminCapabilitiesForRequest,
  getAuthenticatedUserForRequest,
} from "../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const REPORT_REASONS = new Set(["not_cat", "uncomfortable", "other"]);
const AUTO_EXCLUDE_REPORT_COUNT = 2;

type ReportRequest = {
  photoId?: string;
  sourcePhotoId?: string;
  anonymousId?: string;
  reason?: string;
};

export async function GET(request: Request) {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!capabilities.isAdmin) {
    return NextResponse.json({ reports: [] }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ reports: [] }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("photo_reports")
    .select(
      "id, photo_id, source_photo_id, reporter_user_id, reporter_anonymous_id, reason, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ reports: [] }, { status: 200 });
  }

  return NextResponse.json({ reports: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const body = (await request.json().catch(() => null)) as ReportRequest | null;
  const photoId = sanitizeId(body?.photoId);
  const sourcePhotoId = sanitizeId(body?.sourcePhotoId);
  const anonymousId = sanitizeId(body?.anonymousId);
  const reason = REPORT_REASONS.has(body?.reason ?? "")
    ? body!.reason!
    : "other";
  const user = await getAuthenticatedUserForRequest(request);

  if (!photoId || (!user && !anonymousId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { error } = await supabase.from("photo_reports").insert({
    photo_id: photoId,
    source_photo_id: sourcePhotoId,
    reporter_user_id: user?.id ?? null,
    reporter_anonymous_id: user ? null : anonymousId,
    reason,
    metadata: {},
  });

  if (error) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  await maybeExcludeReportedPhoto(sourcePhotoId ?? photoId);

  return NextResponse.json({ ok: true });
}

async function maybeExcludeReportedPhoto(sourcePhotoId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const { count } = await supabase
    .from("photo_reports")
    .select("id", { count: "exact", head: true })
    .or(`source_photo_id.eq.${escapeFilterValue(sourcePhotoId)},photo_id.eq.${escapeFilterValue(sourcePhotoId)}`);

  if ((count ?? 0) < AUTO_EXCLUDE_REPORT_COUNT) {
    return;
  }

  await supabase
    .from("cat_moments")
    .update({ delivery_status: "reported" })
    .eq("local_moment_id", sourcePhotoId);
}

function sanitizeId(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.length > 160 || /[\r\n]/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function escapeFilterValue(value: string) {
  return value.replace(/[,()]/g, "\\$&");
}
