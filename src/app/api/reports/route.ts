import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  getAdminCapabilitiesForRequest,
  getAuthenticatedUserForRequest,
} from "../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const REPORT_REASONS = new Set(["not_cat", "uncomfortable", "other"]);
const AUTO_EXCLUDE_DISTINCT_REPORTER_COUNT = 2;

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

  const verifiedTarget = await readVerifiedDeliveredReportTarget({
    supabase,
    user,
    anonymousId,
    photoId,
    sourcePhotoId,
  });

  if (!verifiedTarget) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const existingReport = await readExistingReportForReporter({
    supabase,
    sourcePhotoId: verifiedTarget.sourcePhotoId,
    user,
    anonymousId,
  });

  if (existingReport) {
    await markVerifiedDeliveryReported(supabase, verifiedTarget.deliveryId);
    await maybeExcludeReportedPhoto(verifiedTarget.sourcePhotoId);
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { error } = await supabase.from("photo_reports").insert({
    photo_id: photoId,
    source_photo_id: verifiedTarget.sourcePhotoId,
    reporter_user_id: user?.id ?? null,
    reporter_anonymous_id: user ? null : anonymousId,
    reason,
    metadata: {
      verified_delivery_id: verifiedTarget.deliveryId,
      verified_source_moment_id: verifiedTarget.sourceMomentId,
    },
  });

  if (error) {
    if (isUniqueReportError(error)) {
      await markVerifiedDeliveryReported(supabase, verifiedTarget.deliveryId);
      await maybeExcludeReportedPhoto(verifiedTarget.sourcePhotoId);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    return NextResponse.json({ ok: false }, { status: 200 });
  }

  await markVerifiedDeliveryReported(supabase, verifiedTarget.deliveryId);
  await maybeExcludeReportedPhoto(verifiedTarget.sourcePhotoId);

  return NextResponse.json({ ok: true });
}

async function markVerifiedDeliveryReported(
  supabase: SupabaseClient,
  deliveryId: string,
) {
  const { error } = await supabase
    .from("cat_moment_deliveries")
    .update({ status: "reported" })
    .eq("id", deliveryId);

  if (error) {
    console.warn("[reports] delivery report status update failed", {
      code: error.code,
    });
  }
}

async function maybeExcludeReportedPhoto(sourcePhotoId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const { data } = await supabase
    .from("photo_reports")
    .select("reporter_user_id, reporter_anonymous_id")
    .eq("source_photo_id", sourcePhotoId)
    .limit(1000);

  const reporterCount = countDistinctReporters(data ?? []);

  if (reporterCount < AUTO_EXCLUDE_DISTINCT_REPORTER_COUNT) {
    return;
  }

  await supabase
    .from("cat_moments")
    .update({ delivery_status: "reported" })
    .eq("local_moment_id", sourcePhotoId);
}

type VerifiedDeliveredReportTarget = {
  deliveryId: string;
  sourceMomentId: string | null;
  sourcePhotoId: string;
};

async function readVerifiedDeliveredReportTarget({
  supabase,
  user,
  anonymousId,
  photoId,
  sourcePhotoId,
}: {
  supabase: SupabaseClient;
  user: User | null;
  anonymousId: string | null;
  photoId: string;
  sourcePhotoId: string | null;
}) {
  if (user) {
    const userDelivery = await readDeliveredReportTargetForIdentity({
      supabase,
      identityColumn: "user_id",
      identityValue: user.id,
      photoId,
      sourcePhotoId,
    });

    if (userDelivery) {
      return userDelivery;
    }
  }

  if (!anonymousId) {
    return null;
  }

  return readDeliveredReportTargetForIdentity({
    supabase,
    identityColumn: "anonymous_id",
    identityValue: anonymousId,
    photoId,
    sourcePhotoId,
  });
}

async function readDeliveredReportTargetForIdentity({
  supabase,
  identityColumn,
  identityValue,
  photoId,
  sourcePhotoId,
}: {
  supabase: SupabaseClient;
  identityColumn: "user_id" | "anonymous_id";
  identityValue: string;
  photoId: string;
  sourcePhotoId: string | null;
}): Promise<VerifiedDeliveredReportTarget | null> {
  const clauses = [`local_delivery_id.eq.${escapeFilterValue(photoId)}`];

  if (sourcePhotoId) {
    clauses.push(`source_photo_id.eq.${escapeFilterValue(sourcePhotoId)}`);
  }

  const { data, error } = await supabase
    .from("cat_moment_deliveries")
    .select("id, source_moment_id, source_photo_id")
    .eq(identityColumn, identityValue)
    .or(clauses.join(","))
    .order("delivered_at", { ascending: false })
    .limit(1);

  if (error) {
    return null;
  }

  const delivery = data?.[0];
  const verifiedSourcePhotoId =
    typeof delivery?.source_photo_id === "string"
      ? sanitizeId(delivery.source_photo_id)
      : null;

  if (!delivery?.id || !verifiedSourcePhotoId) {
    return null;
  }

  return {
    deliveryId: delivery.id,
    sourceMomentId:
      typeof delivery.source_moment_id === "string"
        ? delivery.source_moment_id
        : null,
    sourcePhotoId: verifiedSourcePhotoId,
  };
}

async function readExistingReportForReporter({
  supabase,
  sourcePhotoId,
  user,
  anonymousId,
}: {
  supabase: SupabaseClient;
  sourcePhotoId: string;
  user: User | null;
  anonymousId: string | null;
}) {
  let query = supabase
    .from("photo_reports")
    .select("id")
    .eq("source_photo_id", sourcePhotoId)
    .limit(1);

  query = user
    ? query.eq("reporter_user_id", user.id)
    : query.eq("reporter_anonymous_id", anonymousId ?? "");

  const { data, error } = await query;

  if (error) {
    return null;
  }

  return data?.[0] ?? null;
}

function countDistinctReporters(
  reports: Array<{
    reporter_user_id: string | null;
    reporter_anonymous_id: string | null;
  }>,
) {
  const reporters = new Set<string>();

  for (const report of reports) {
    if (report.reporter_user_id) {
      reporters.add(`user:${report.reporter_user_id}`);
    } else if (report.reporter_anonymous_id) {
      reporters.add(`anon:${report.reporter_anonymous_id}`);
    }
  }

  return reporters.size;
}

function isUniqueReportError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    /photo_reports_source_(?:user|anonymous)_uidx/i.test(error.message ?? "")
  );
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
