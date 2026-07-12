import { NextResponse } from "next/server";

import { authorizeAdminTaskRequest } from "../../../../lib/server/adminTaskAuth";
import { checkAdminTaskRateLimit } from "../../../../lib/server/adminTaskRateLimit";
import { runCatPhotosBackup } from "../../../../lib/server/storageBackup";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runBackup(request);
}

export async function POST(request: Request) {
  return runBackup(request);
}

async function runBackup(request: Request) {
  const unauthorized = authorizeAdminTaskRequest(request);
  if (unauthorized) {
    return unauthorized;
  }

  const rateLimited = checkAdminTaskRateLimit(request, "storage-backup");
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

  try {
    const result = await runCatPhotosBackup(supabase);
    console.info("[admin/storage-backup] completed", result);
    return NextResponse.json(
      { ok: result.failed === 0, ...result },
      { status: result.failed === 0 ? 200 : 500 },
    );
  } catch (error) {
    console.error("[admin/storage-backup] failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "storage_backup_failed" },
      { status: 500 },
    );
  }
}
