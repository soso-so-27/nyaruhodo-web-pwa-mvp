import { NextResponse } from "next/server";

import {
  CAT_PHOTOS_BUCKET,
  getStoragePhotoPath,
} from "../../../../../lib/photoStorage";
import { normalizeAnonymousId } from "../../../../../lib/photoStorageAuthorization";
import { removeHandoffStorageObjects } from "../../../../../lib/server/handoffStorageCleanup";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

type RedeemHandoffBody = {
  anonymousId?: unknown;
  token?: unknown;
};

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "handoff_store_unavailable" },
      { status: 503 },
    );
  }

  let body: RedeemHandoffBody;
  try {
    body = (await request.json()) as RedeemHandoffBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^onb_[a-f0-9-]{36}_[a-f0-9]{36}$/.test(token)) {
    return NextResponse.json(
      { ok: false, error: "invalid_token" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("onboarding_handoffs")
    .select("payload, expires_at, redeemed_at, redeem_count")
    .eq("handoff_token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "handoff_lookup_failed" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "handoff_not_found" },
      { status: 404 },
    );
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    await cleanupExpiredHandoff(supabase, token);
    return NextResponse.json(
      { ok: false, error: "handoff_expired" },
      { status: 410 },
    );
  }

  let payload: unknown;
  try {
    payload = await hydrateHandoffStorageRefs(data.payload, token, supabase);
  } catch {
    return NextResponse.json(
      { ok: false, error: "handoff_payload_unavailable" },
      { status: 500 },
    );
  }

  const targetAnonymousId = normalizeAnonymousId(body.anonymousId);
  if (targetAnonymousId) {
    await transferOnboardingAnonymousRows(
      supabase,
      data.payload,
      targetAnonymousId,
    );
  }

  const now = new Date().toISOString();
  const { error: redeemError } = await supabase
    .from("onboarding_handoffs")
    .update({
      redeemed_at: data.redeemed_at ?? now,
      last_redeemed_at: now,
      redeem_count: Number(data.redeem_count) + 1,
    })
    .eq("handoff_token", token);

  if (redeemError) {
    return NextResponse.json(
      { ok: false, error: "handoff_redeem_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    payload,
  });
}

async function transferOnboardingAnonymousRows(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  payload: unknown,
  targetAnonymousId: string,
) {
  const progress = readOnboardingProgress(payload);
  const sourceAnonymousId = normalizeAnonymousId(progress?.anonymousId);

  if (!sourceAnonymousId || sourceAnonymousId === targetAnonymousId) {
    return;
  }

  const ownPhotoId = normalizeLocalId(progress?.ownPhoto?.id);
  const deliveryId = normalizeLocalId(progress?.deliveredPhoto?.id);

  if (ownPhotoId) {
    const { error } = await supabase
      .from("cat_moments")
      .update({ anonymous_id: targetAnonymousId })
      .is("user_id", null)
      .eq("anonymous_id", sourceAnonymousId)
      .eq("local_moment_id", ownPhotoId);

    if (error) {
      console.warn("[onboarding/handoff/redeem] own photo identity transfer failed", {
        code: error.code,
      });
    }
  }

  if (deliveryId) {
    const { error } = await supabase
      .from("cat_moment_deliveries")
      .update({ anonymous_id: targetAnonymousId })
      .is("user_id", null)
      .eq("anonymous_id", sourceAnonymousId)
      .eq("local_delivery_id", deliveryId);

    if (error) {
      console.warn("[onboarding/handoff/redeem] delivery identity transfer failed", {
        code: error.code,
      });
    }
  }
}

function readOnboardingProgress(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const progress = (payload as {
    onboardingProgress?: unknown;
  }).onboardingProgress;

  if (!progress || typeof progress !== "object") {
    return null;
  }

  return progress as {
    anonymousId?: unknown;
    deliveredPhoto?: { id?: unknown } | null;
    ownPhoto?: { id?: unknown } | null;
  };
}

function normalizeLocalId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const id = value.trim();
  return id && id.length <= 240 ? id : null;
}

async function cleanupExpiredHandoff(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  token: string,
) {
  try {
    await removeHandoffStorageObjects(supabase, token);
  } catch (error) {
    console.warn("[onboarding/handoff/redeem] expired handoff storage cleanup failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const { error } = await supabase
    .from("onboarding_handoffs")
    .update({ payload: null })
    .eq("handoff_token", token);

  if (error) {
    console.warn("[onboarding/handoff/redeem] expired handoff payload cleanup failed", {
      error: error.message,
    });
  }
}

async function hydrateHandoffStorageRefs(
  value: unknown,
  token: string,
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  depth = 0,
  cache = new Map<string, string>(),
): Promise<unknown> {
  if (depth > 8) {
    return null;
  }

  if (typeof value === "string") {
    const storagePath = getStoragePhotoPath(value);
    const prefix = `handoffs/${token}/`;

    if (!storagePath || !storagePath.startsWith(prefix)) {
      return value;
    }

    if (cache.has(storagePath)) {
      return cache.get(storagePath) ?? value;
    }

    const dataUrl = await downloadStorageObjectAsDataUrl(storagePath, supabase);
    cache.set(storagePath, dataUrl);
    return dataUrl;
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item) =>
        hydrateHandoffStorageRefs(item, token, supabase, depth + 1, cache),
      ),
    );
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[key] = await hydrateHandoffStorageRefs(
        item,
        token,
        supabase,
        depth + 1,
        cache,
      );
    }

    return next;
  }

  return value;
}

async function downloadStorageObjectAsDataUrl(
  path: string,
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
) {
  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .download(path);

  if (error || !data) {
    throw new Error("handoff_storage_download_failed");
  }

  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const contentType = data.type || getContentTypeFromPath(path);

  return `data:${contentType};base64,${base64}`;
}

function getContentTypeFromPath(path: string) {
  if (path.endsWith(".webp")) {
    return "image/webp";
  }

  if (path.endsWith(".png")) {
    return "image/png";
  }

  return "image/jpeg";
}
