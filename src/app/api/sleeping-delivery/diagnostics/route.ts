import { NextResponse } from "next/server";

import { isUsablePhotoSrc } from "../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

type DiagnosticsRequest = {
  blockedPhotoIds?: string[];
};

type RemoteCatMomentRow = {
  id: string;
  local_moment_id: string;
  photo_url: string;
  delivery_status: "available" | "hidden" | "reported";
  metadata: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DiagnosticsRequest;
  const blockedPhotoIds = new Set(
    Array.isArray(body.blockedPhotoIds)
      ? body.blockedPhotoIds.filter((id) => typeof id === "string")
      : [],
  );
  const supabase =
    createSupabaseAdminClient() ?? (await createServerSupabaseClient());

  if (!supabase) {
    return NextResponse.json(
      buildEmptyDiagnostics("error", "server_unavailable"),
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("cat_moments")
    .select("id, local_moment_id, photo_url, delivery_status, metadata")
    .eq("visibility", "shared")
    .in("delivery_status", ["available", "hidden", "reported"])
    .limit(500);

  if (error) {
    return NextResponse.json(buildEmptyDiagnostics("error", error.message), {
      status: 500,
    });
  }

  const rows = (data ?? []) as RemoteCatMomentRow[];
  const availableRows = rows.filter((row) => row.delivery_status === "available");
  const unusableRows = availableRows.filter(
    (row) => !isUsablePhotoSrc(row.photo_url),
  );
  const blockedRows = availableRows.filter(
    (row) => blockedPhotoIds.has(row.id) || blockedPhotoIds.has(row.local_moment_id),
  );
  const candidateRows = availableRows.filter(
    (row) =>
      isUsablePhotoSrc(row.photo_url) &&
      !blockedPhotoIds.has(row.id) &&
      !blockedPhotoIds.has(row.local_moment_id),
  );
  const fallbackRows =
    candidateRows.length === 0 && blockedPhotoIds.size > 0
      ? availableRows.filter(
          (row) =>
            readPoolKind(row.metadata) === "admin_stock" &&
            isUsablePhotoSrc(row.photo_url),
        )
      : [];
  const effectiveCandidateRows =
    candidateRows.length > 0 ? candidateRows : fallbackRows;

  return NextResponse.json({
    source: effectiveCandidateRows.length > 0 ? "remote" : "none",
    availableCount: availableRows.length,
    candidateCount: effectiveCandidateRows.length,
    normalCandidateCount: candidateRows.length,
    fallbackCandidateCount: fallbackRows.length,
    fallbackActive: candidateRows.length === 0 && fallbackRows.length > 0,
    excludedCount: Math.max(0, availableRows.length - effectiveCandidateRows.length),
    unusableCount: unusableRows.length,
    blockedCount: blockedRows.length,
    adminStockCount: availableRows.filter(
      (row) => readPoolKind(row.metadata) === "admin_stock",
    ).length,
    userSharedCount: availableRows.filter(
      (row) => readPoolKind(row.metadata) === "user_shared",
    ).length,
    hiddenCount: rows.filter((row) => row.delivery_status === "hidden").length,
    reportedCount: rows.filter((row) => row.delivery_status === "reported").length,
    rlsReadable: true,
    lastError: null,
    checkedAt: new Date().toISOString(),
  });
}

function buildEmptyDiagnostics(source: "none" | "error", lastError: string) {
  return {
    source,
    availableCount: 0,
    candidateCount: 0,
    normalCandidateCount: 0,
    fallbackCandidateCount: 0,
    fallbackActive: false,
    excludedCount: 0,
    unusableCount: 0,
    blockedCount: 0,
    adminStockCount: 0,
    userSharedCount: 0,
    hiddenCount: 0,
    reportedCount: 0,
    rlsReadable: false,
    lastError,
    checkedAt: new Date().toISOString(),
  };
}

function readPoolKind(metadata: Record<string, unknown> | null) {
  const poolKind = metadata?.pool_kind;

  if (poolKind === "admin_stock" || poolKind === "user_shared") {
    return poolKind;
  }

  return "unknown";
}
