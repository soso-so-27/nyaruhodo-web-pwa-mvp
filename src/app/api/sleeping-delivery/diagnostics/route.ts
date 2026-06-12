import { NextResponse } from "next/server";

import { isUsablePhotoSrc } from "../../../../lib/photoStorage";
import { isBlockedDeliveryPoolRow } from "../../../../lib/home/deliveryPoolGuards";
import { getAdminCapabilitiesForRequest } from "../../../../lib/adminAccess";
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
  moderation_status?: "pending" | "approved" | "rejected";
  pool_date?: string | null;
  metadata: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!capabilities.testToolsEnabled) {
    return NextResponse.json(
      { source: "error", error: "admin_required" },
      { status: 403 },
    );
  }

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
    .select("id, local_moment_id, photo_url, delivery_status, moderation_status, pool_date, metadata")
    .eq("visibility", "shared")
    .in("delivery_status", ["available", "hidden", "reported"])
    .limit(500);

  if (error) {
    return NextResponse.json(buildEmptyDiagnostics("error", error.message), {
      status: 500,
    });
  }

  const rows = (data ?? []) as RemoteCatMomentRow[];
  const totalSharedRows = rows.length;
  const blockedPoolRows = rows.filter(isBlockedDeliveryPoolRow);
  const unblockedRows = rows.filter((row) => !isBlockedDeliveryPoolRow(row));
  const availableRows = rows.filter(
    (row) => row.delivery_status === "available" && !isBlockedDeliveryPoolRow(row),
  );
  const storageRows = unblockedRows.filter((row) => row.photo_url.startsWith("storage:"));
  const approvedAvailableRows = availableRows.filter(
    (row) => row.moderation_status === "approved",
  );
  const exchangeAvailableRows = availableRows.filter(
    (row) => row.moderation_status === "approved",
  );
  const unusableRows = availableRows.filter(
    (row) => row.moderation_status === "approved" && !isUsablePhotoSrc(row.photo_url),
  );
  const blockedRows = exchangeAvailableRows.filter(
    (row) => blockedPhotoIds.has(row.id) || blockedPhotoIds.has(row.local_moment_id),
  );
  const candidateRows = exchangeAvailableRows.filter(
    (row) =>
      isUsablePhotoSrc(row.photo_url) &&
      !blockedPhotoIds.has(row.id) &&
      !blockedPhotoIds.has(row.local_moment_id),
  );
  const fallbackRows =
    candidateRows.length === 0
      ? approvedAvailableRows.filter(
          (row) =>
            (readPoolKind(row.metadata) === "admin_stock" ||
              readPoolKind(row.metadata) === "user_shared") &&
            isUsablePhotoSrc(row.photo_url) &&
            !isBlockedDeliveryPoolRow(row),
        )
      : [];
  const effectiveCandidateRows =
    candidateRows.length > 0 ? candidateRows : fallbackRows;
  const tier1Rows = candidateRows.filter(
    (row) => readPoolKind(row.metadata) !== "admin_stock" && row.pool_date,
  );
  const tier3Rows = candidateRows.filter(
    (row) => readPoolKind(row.metadata) === "admin_stock",
  );

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
    blockedPoolCount: blockedPoolRows.length,
    totalSharedRows,
    blockedRows: blockedPoolRows.length,
    storageExcludedRows: 0,
    deliverableRows: effectiveCandidateRows.length,
    dataImageDeliverableRows: effectiveCandidateRows.filter((row) =>
      row.photo_url.startsWith("data:image/"),
    ).length,
    httpDeliverableRows: effectiveCandidateRows.filter((row) =>
      row.photo_url.startsWith("http://") || row.photo_url.startsWith("https://"),
    ).length,
    storageRows: storageRows.length,
    moderationPendingCount: rows.filter((row) => row.moderation_status === "pending").length,
    moderationApprovedCount: rows.filter((row) => row.moderation_status === "approved").length,
    moderationRejectedCount: rows.filter((row) => row.moderation_status === "rejected").length,
    tier1CandidateCount: tier1Rows.length,
    tier2CandidateCount: Math.max(0, candidateRows.length - tier1Rows.length - tier3Rows.length),
    tier3CandidateCount: tier3Rows.length,
    moderationExcludedCount: Math.max(0, availableRows.length - approvedAvailableRows.length),
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
    blockedPoolCount: 0,
    totalSharedRows: 0,
    blockedRows: 0,
    storageExcludedRows: 0,
    deliverableRows: 0,
    dataImageDeliverableRows: 0,
    httpDeliverableRows: 0,
    storageRows: 0,
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
