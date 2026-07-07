import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  CAT_PHOTOS_BUCKET,
  sanitizePathSegment,
} from "../../../../lib/photoStorage";
import { isSafeStoragePath } from "../../../../lib/photoStorageAuthorization";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

const MAX_COPY_PATHS = 160;

type CopyAnonymousStorageRequest = {
  fromUserId?: unknown;
  paths?: unknown;
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

  if (!fromUserId || fromUserId === targetUser.id || paths.length === 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  if (paths.length > MAX_COPY_PATHS) {
    return NextResponse.json(
      { ok: false, error: "too_many_paths" },
      { status: 413 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "server_unavailable" },
      { status: 503 },
    );
  }

  const mappings: CopyMapping[] = [];
  const failures: Array<{ path: string; error: string }> = [];
  const uniquePaths = Array.from(new Set(paths));

  for (const sourcePath of uniquePaths) {
    if (!isCopyableAnonymousStoragePath(sourcePath, fromUserId)) {
      failures.push({ path: sourcePath, error: "invalid_path" });
      continue;
    }

    const targetPath = buildTargetPath({
      fromUserId,
      sourcePath,
      targetUserId: targetUser.id,
    });
    const { error } = await supabase.storage
      .from(CAT_PHOTOS_BUCKET)
      .copy(sourcePath, targetPath);

    if (error && !isAlreadyExistsError(error.message)) {
      failures.push({ path: sourcePath, error: "copy_failed" });
      continue;
    }

    mappings.push({ from: sourcePath, to: targetPath });
  }

  return NextResponse.json({
    ok: true,
    copied: mappings.length,
    failures: failures.slice(0, 20),
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

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

function isAnonymousUser(user: { is_anonymous?: boolean }) {
  return user.is_anonymous === true;
}

function isCopyableAnonymousStoragePath(path: string, fromUserId: string) {
  return isSafeStoragePath(path) && path.split("/")[0] === fromUserId;
}

function buildTargetPath({
  fromUserId,
  sourcePath,
  targetUserId,
}: {
  fromUserId: string;
  sourcePath: string;
  targetUserId: string;
}) {
  const [, ...restSegments] = sourcePath.split("/");
  const safeRest = restSegments.map(sanitizePathSegment).join("/");

  return [
    targetUserId,
    "anonymous-transfer",
    sanitizePathSegment(fromUserId),
    safeRest || "photo",
  ].join("/");
}

function isAlreadyExistsError(message: string) {
  return /already exists|duplicate|409/i.test(message);
}
