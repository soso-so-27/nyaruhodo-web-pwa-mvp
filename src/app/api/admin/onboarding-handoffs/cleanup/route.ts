import { NextResponse } from "next/server";

import { authorizeAdminTaskRequest } from "../../../../../lib/server/adminTaskAuth";
import { checkAdminTaskRateLimit } from "../../../../../lib/server/adminTaskRateLimit";
import { removeHandoffStorageObjects } from "../../../../../lib/server/handoffStorageCleanup";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;
const DELETE_AFTER_DAYS = 90;

type HandoffCleanupRow = {
  handoff_token: string;
  expires_at: string;
  redeemed_at: string | null;
};

export async function GET(request: Request) {
  return runCleanup(request);
}

export async function POST(request: Request) {
  return runCleanup(request);
}

async function runCleanup(request: Request) {
  const unauthorized = authorizeAdminTaskRequest(request);
  if (unauthorized) {
    return unauthorized;
  }

  const rateLimited = checkAdminTaskRateLimit(request, "handoff-cleanup");
  if (rateLimited) {
    return rateLimited;
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "admin_unavailable" },
      { status: 503 },
    );
  }

  const limit = readLimit(request);
  const now = new Date();
  const nowIso = now.toISOString();
  const deleteBeforeIso = new Date(
    now.getTime() - DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from("onboarding_handoffs")
    .select("handoff_token, expires_at, redeemed_at")
    .lt("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "handoff_cleanup_lookup_failed" },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as HandoffCleanupRow[];
  let storageDeleted = 0;
  let storageFailures = 0;
  const cleanedTokens: string[] = [];

  for (const row of rows) {
    try {
      storageDeleted += await removeHandoffStorageObjects(
        supabase,
        row.handoff_token,
      );
      cleanedTokens.push(row.handoff_token);
    } catch (cleanupError) {
      storageFailures += 1;
      console.warn("[admin/onboarding-handoffs/cleanup] storage cleanup failed", {
        token: row.handoff_token,
        error:
          cleanupError instanceof Error ? cleanupError.message : "unknown",
      });
    }
  }

  let payloadCleared = 0;
  if (cleanedTokens.length > 0) {
    const { error: updateError } = await supabase
      .from("onboarding_handoffs")
      .update({ payload: null })
      .in("handoff_token", cleanedTokens);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: "handoff_cleanup_update_failed" },
        { status: 500 },
      );
    }
    payloadCleared = cleanedTokens.length;
  }

  const deleteTokens = rows
    .filter((row) => new Date(row.expires_at).toISOString() < deleteBeforeIso)
    .map((row) => row.handoff_token)
    .filter((token) => cleanedTokens.includes(token));
  let recordsDeleted = 0;

  if (deleteTokens.length > 0) {
    const { error: deleteError } = await supabase
      .from("onboarding_handoffs")
      .delete()
      .in("handoff_token", deleteTokens);

    if (deleteError) {
      return NextResponse.json(
        { ok: false, error: "handoff_cleanup_delete_failed" },
        { status: 500 },
      );
    }
    recordsDeleted = deleteTokens.length;
  }

  console.info("[admin/onboarding-handoffs/cleanup] completed", {
    scanned: rows.length,
    storageDeleted,
    storageFailures,
    payloadCleared,
    recordsDeleted,
  });

  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    storageDeleted,
    storageFailures,
    payloadCleared,
    recordsDeleted,
  });
}

function readLimit(request: Request) {
  try {
    const url = new URL(request.url);
    const value = Number(url.searchParams.get("limit"));
    if (Number.isFinite(value) && value > 0) {
      return Math.min(MAX_LIMIT, Math.floor(value));
    }
  } catch {
    // Keep the safe default.
  }

  return DEFAULT_LIMIT;
}
