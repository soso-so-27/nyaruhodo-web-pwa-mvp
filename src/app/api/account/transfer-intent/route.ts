import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  ANONYMOUS_STORAGE_TRANSFER_TTL_MS,
  normalizeAnonymousTransferPaths,
} from "../../../../lib/auth/anonymousStorageTransfer";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

type TransferIntentRequest = {
  paths?: unknown;
};

export async function POST(request: Request) {
  const user = await authenticateUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "auth_required" },
      { status: 401 },
    );
  }

  if (user.is_anonymous !== true) {
    return NextResponse.json(
      { ok: false, error: "anonymous_session_required" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | TransferIntentRequest
    | null;
  const paths = Array.isArray(body?.paths) ? body.paths : [];
  const normalized = normalizeAnonymousTransferPaths({
    fromUserId: user.id,
    paths,
  });

  if (normalized.error) {
    return NextResponse.json(
      { ok: false, error: normalized.error },
      { status: normalized.error === "too_many_paths" ? 413 : 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "server_unavailable" },
      { status: 503 },
    );
  }

  const transferToken = `anon_tx_${randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(
    Date.now() + ANONYMOUS_STORAGE_TRANSFER_TTL_MS,
  ).toISOString();
  const { error } = await supabase
    .from("anonymous_storage_transfer_intents")
    .insert({
      anonymous_user_id: user.id,
      expires_at: expiresAt,
      paths: normalized.paths,
      transfer_token: transferToken,
    });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "intent_create_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    expiresAt,
    pathCount: normalized.paths.length,
    transferToken,
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

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}
