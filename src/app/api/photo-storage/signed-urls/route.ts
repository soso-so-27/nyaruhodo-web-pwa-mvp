import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  CAT_PHOTOS_BUCKET,
  DISPLAY_SIGNED_URL_SECONDS,
  createSignedStorageUrls,
  getStoragePhotoPath,
} from "../../../../lib/photoStorage";
import {
  getStoragePhotoUrlVariants,
  hasDeliveredStoragePhoto,
  isAuthorizedStoragePhotoPath,
  isSafeStoragePath,
  normalizeAnonymousId,
} from "../../../../lib/photoStorageAuthorization";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

const MAX_BATCH_SIGNED_URL_PATHS = 80;

type SignedUrlsRequest = {
  anonymousId?: unknown;
  paths?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignedUrlsRequest | null;
  const storagePaths = normalizeStoragePaths(body?.paths);

  if (storagePaths.length === 0) {
    return NextResponse.json({ signedUrls: {}, error: "invalid_photo" }, { status: 400 });
  }

  if (storagePaths.some((path) => !isSafeStoragePath(path))) {
    return NextResponse.json({ signedUrls: {}, error: "invalid_photo" }, { status: 400 });
  }

  const bearerToken = getBearerToken(request);
  const anonymousId = normalizeAnonymousId(body?.anonymousId);
  const signingSupabase = createSupabaseAdminClient();

  if (!signingSupabase) {
    return NextResponse.json({ signedUrls: {}, error: "server_unavailable" }, { status: 503 });
  }

  if (!bearerToken) {
    if (!anonymousId) {
      return NextResponse.json({ signedUrls: {}, error: "auth_required" }, { status: 401 });
    }

    const signedUrls: Record<string, string | null> = {};
    const authorizedPaths: string[] = [];

    for (const storagePath of storagePaths) {
      const isDeliveredToAnonymousSession = await hasDeliveredStoragePhoto({
        supabase: signingSupabase,
        photoUrlVariants: getStoragePhotoUrlVariants(storagePath),
        userId: "",
        anonymousId,
      });

      signedUrls[storagePath] = null;
      if (isDeliveredToAnonymousSession) {
        authorizedPaths.push(storagePath);
      }
    }

    const batchSignedUrls = await createSignedStorageUrls(
      signingSupabase,
      authorizedPaths,
    );

    for (const storagePath of authorizedPaths) {
      signedUrls[storagePath] = batchSignedUrls[storagePath] ?? null;
    }

    return createStorageSignedUrlsResponse(signedUrls);
  }

  const config = getSupabasePublicConfig();

  if (!config) {
    return NextResponse.json({ signedUrls: {}, error: "server_unavailable" }, { status: 503 });
  }

  const authSupabase = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await authSupabase.auth.getUser(bearerToken);
  const userId = data.user?.id ?? null;

  if (error || !userId) {
    return NextResponse.json({ signedUrls: {}, error: "auth_required" }, { status: 401 });
  }

  const signedUrls: Record<string, string | null> = {};
  const authorizedPaths: string[] = [];

  for (const storagePath of storagePaths) {
    const isAuthorized = await isAuthorizedStoragePhotoPath({
      storagePath,
      userId,
      anonymousId,
      hasDeliveredPhoto: (photoUrlVariants, checkedUserId, checkedAnonymousId) =>
        hasDeliveredStoragePhoto({
          supabase: signingSupabase,
          photoUrlVariants,
          userId: checkedUserId,
          anonymousId: checkedAnonymousId,
        }),
    });

    signedUrls[storagePath] = null;
    if (isAuthorized) {
      authorizedPaths.push(storagePath);
    }
  }

  const batchSignedUrls = await createSignedStorageUrls(
    signingSupabase,
    authorizedPaths,
  );

  for (const storagePath of authorizedPaths) {
    signedUrls[storagePath] = batchSignedUrls[storagePath] ?? null;
  }

  return createStorageSignedUrlsResponse(signedUrls);
}

function normalizeStoragePaths(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => {
          const raw = typeof item === "string" ? item.trim() : "";
          return raw ? getStoragePhotoPath(raw) ?? raw : "";
        })
        .filter(Boolean),
    ),
  ).slice(0, MAX_BATCH_SIGNED_URL_PATHS);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

function createStorageSignedUrlsResponse(signedUrls: Record<string, string | null>) {
  return NextResponse.json({
    bucket: CAT_PHOTOS_BUCKET,
    expiresIn: DISPLAY_SIGNED_URL_SECONDS,
    signedUrls,
  });
}
