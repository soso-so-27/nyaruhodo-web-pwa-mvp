import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  CAT_PHOTOS_BUCKET,
  createSignedStorageUrl,
  getStoragePhotoPath,
} from "../../../../lib/photoStorage";
import {
  hasDeliveredStoragePhoto,
  isAuthorizedStoragePhotoPath,
  isSafeStoragePath,
  normalizeAnonymousId,
} from "../../../../lib/photoStorageAuthorization";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

type SignedUrlRequest = {
  anonymousId?: unknown;
  src?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignedUrlRequest | null;
  const storagePath = getStoragePhotoPath(typeof body?.src === "string" ? body.src : "");

  if (!storagePath || !isSafeStoragePath(storagePath)) {
    return NextResponse.json({ signedUrl: null, error: "invalid_photo" }, { status: 400 });
  }

  const bearerToken = getBearerToken(request);

  if (!bearerToken) {
    return NextResponse.json({ signedUrl: null, error: "auth_required" }, { status: 401 });
  }

  const config = getSupabasePublicConfig();

  if (!config) {
    return NextResponse.json({ signedUrl: null, error: "server_unavailable" }, { status: 503 });
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
    return NextResponse.json({ signedUrl: null, error: "auth_required" }, { status: 401 });
  }

  const signingSupabase =
    createSupabaseAdminClient() ??
    createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    });
  const isAuthorized = await isAuthorizedStoragePhotoPath({
    storagePath,
    userId,
    anonymousId: normalizeAnonymousId(body?.anonymousId),
    hasDeliveredPhoto: (photoUrlVariants, checkedUserId, anonymousId) =>
      hasDeliveredStoragePhoto({
        supabase: signingSupabase,
        photoUrlVariants,
        userId: checkedUserId,
        anonymousId,
      }),
  });

  if (!isAuthorized) {
    return NextResponse.json({ signedUrl: null, error: "forbidden_photo" }, { status: 403 });
  }

  return createStorageSignedUrlResponse(storagePath, signingSupabase);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function createStorageSignedUrlResponse(
  storagePath: string,
  signingSupabase: SupabaseClient,
) {
  const signedUrl = await createSignedStorageUrl(signingSupabase, storagePath);

  if (!signedUrl) {
    return NextResponse.json({ signedUrl: null, error: "photo_unavailable" }, { status: 404 });
  }

  return NextResponse.json({ bucket: CAT_PHOTOS_BUCKET, signedUrl });
}
