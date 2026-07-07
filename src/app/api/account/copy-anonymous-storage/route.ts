import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  buildAnonymousTransferTargetPath,
  getReusableTransferMappings,
  isAlreadyExistsStorageCopyError,
  isTransferIntentExpired,
  normalizeAnonymousTransferPaths,
  type AnonymousStorageTransferIntentRow,
} from "../../../../lib/auth/anonymousStorageTransfer";
import { CAT_PHOTOS_BUCKET } from "../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

type CopyAnonymousStorageRequest = {
  fromUserId?: unknown;
  paths?: unknown;
  transferToken?: unknown;
};

type CopyMapping = {
  from: string;
  to: string;
};

export async function POST(request: Request) {
  const targetUser = await authenticateUser(request);

  if (!targetUser) {
    return NextResponse.json(
      { ok: false, error: "auth_required" },
      { status: 401 },
    );
  }

  if (isAnonymousUser(targetUser)) {
    return NextResponse.json(
      { ok: false, error: "target_account_required" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | CopyAnonymousStorageRequest
    | null;
  const fromUserId =
    typeof body?.fromUserId === "string" ? body.fromUserId.trim() : "";
  const paths = Array.isArray(body?.paths)
    ? body.paths.filter((path): path is string => typeof path === "string")
    : [];
  const transferToken =
    typeof body?.transferToken === "string" ? body.transferToken.trim() : "";

  if (
    !fromUserId ||
    fromUserId === targetUser.id ||
    paths.length === 0 ||
    !transferToken
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "server_unavailable" },
      { status: 503 },
    );
  }

  const intent = await readTransferIntent(supabase, transferToken);

  if (!intent) {
    return NextResponse.json(
      { ok: false, error: "transfer_intent_not_found" },
      { status: 403 },
    );
  }

  const reusableMappings = getReusableTransferMappings({
    intent,
    targetUserId: targetUser.id,
  });

  if (reusableMappings) {
    return NextResponse.json({
      ok: true,
      copied: reusableMappings.length,
      idempotent: true,
      mappings: reusableMappings,
    });
  }

  if (intent.used_at) {
    return NextResponse.json(
      { ok: false, error: "transfer_intent_used" },
      { status: 409 },
    );
  }

  if (
    intent.anonymous_user_id !== fromUserId ||
    isTransferIntentExpired(intent.expires_at)
  ) {
    return NextResponse.json(
      { ok: false, error: "transfer_intent_invalid" },
      { status: 403 },
    );
  }

  const allowedPaths = Array.isArray(intent.paths)
    ? intent.paths.filter((path): path is string => typeof path === "string")
    : [];
  const normalized = normalizeAnonymousTransferPaths({
    allowedPaths,
    fromUserId,
    paths,
  });

  if (normalized.error) {
    return NextResponse.json(
      { ok: false, error: normalized.error },
      { status: normalized.error === "too_many_paths" ? 413 : 400 },
    );
  }

  const mappings: CopyMapping[] = [];
  const failures: Array<{ path: string; error: string }> = [];

  for (const sourcePath of normalized.paths) {
    const targetPath = buildAnonymousTransferTargetPath({
      fromUserId,
      sourcePath,
      targetUserId: targetUser.id,
    });
    const { error } = await supabase.storage
      .from(CAT_PHOTOS_BUCKET)
      .copy(sourcePath, targetPath);

    if (error && !isAlreadyExistsStorageCopyError(error.message)) {
      failures.push({ path: sourcePath, error: "copy_failed" });
      continue;
    }

    mappings.push({ from: sourcePath, to: targetPath });
  }

  if (failures.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        copied: mappings.length,
        error: "copy_failed",
        failures: failures.slice(0, 20),
        mappings,
      },
      { status: 502 },
    );
  }

  const { error: markUsedError } = await supabase
    .from("anonymous_storage_transfer_intents")
    .update({
      mappings,
      target_user_id: targetUser.id,
      used_at: new Date().toISOString(),
    })
    .eq("transfer_token", transferToken)
    .is("used_at", null);

  if (markUsedError) {
    return NextResponse.json(
      { ok: false, error: "transfer_intent_update_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    copied: mappings.length,
    failures: [],
    mappings,
  });
}

async function authenticateUser(request: Request) {
  const bearerToken = getBearerToken(request);

  if (!bearerToken) {
    return null;
  }

  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(bearerToken);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

async function readTransferIntent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  transferToken: string,
) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("anonymous_storage_transfer_intents")
    .select(
      "anonymous_user_id, expires_at, mappings, paths, target_user_id, transfer_token, used_at",
    )
    .eq("transfer_token", transferToken)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as AnonymousStorageTransferIntentRow;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

function isAnonymousUser(user: { is_anonymous?: boolean }) {
  return user.is_anonymous === true;
}
