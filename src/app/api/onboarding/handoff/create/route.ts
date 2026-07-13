import { NextResponse } from "next/server";

import {
  CAT_PHOTOS_BUCKET,
  getDataUrlExtension,
  isLikelySignedPhotoUrl,
  sanitizePathSegment,
  toStoragePhotoUrl,
} from "../../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_DATA_URL_BYTES = 3 * 1024 * 1024;
const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 80;
const MAX_OBJECT_KEYS = 80;
const HANDOFF_EXPIRES_MS = 2 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_MAX_BUCKETS = 500;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

type CreateHandoffBody = {
  payload?: unknown;
  source?: unknown;
};

export async function POST(request: Request) {
  if (!checkHandoffCreateRateLimit(request)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "handoff_store_unavailable" },
      { status: 503 },
    );
  }

  let body: CreateHandoffBody;
  try {
    body = (await request.json()) as CreateHandoffBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  const rawPayloadSize = getJsonByteLength(body.payload);
  if (!body.payload || rawPayloadSize > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: "payload_too_large" },
      { status: 413 },
    );
  }

  const token = createHandoffToken();
  let payload: unknown;

  try {
    payload = await persistDataUrls({
      value: body.payload,
      token,
      supabase,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "persist_failed";
    const status = message === "data_url_too_large" ? 413 : 400;

    return NextResponse.json(
      { ok: false, error: message },
      { status },
    );
  }

  const expiresAt = new Date(Date.now() + HANDOFF_EXPIRES_MS).toISOString();
  const { error } = await supabase.from("onboarding_handoffs").insert({
    handoff_token: token,
    payload,
    source: typeof body.source === "string" ? body.source.slice(0, 80) : null,
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "handoff_insert_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    token,
    expiresAt,
    continueUrl: `/onboarding/continue?handoff=${encodeURIComponent(token)}`,
  });
}

async function persistDataUrls({
  value,
  token,
  supabase,
  depth = 0,
  uploadIndex = { current: 0 },
  dataUrlPaths = new Map<string, string>(),
}: {
  value: unknown;
  token: string;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  depth?: number;
  uploadIndex?: { current: number };
  dataUrlPaths?: Map<string, string>;
}): Promise<unknown> {
  if (depth > MAX_DEPTH) {
    return null;
  }

  if (typeof value === "string") {
    if (isLikelySignedPhotoUrl(value)) {
      return null;
    }

    if (!value.startsWith("data:image/")) {
      return value;
    }

    if (!isAllowedImageDataUrl(value)) {
      throw new Error("unsupported_data_url");
    }

    if (getUtf8ByteLength(value) > MAX_DATA_URL_BYTES) {
      throw new Error("data_url_too_large");
    }

    const existingPath = dataUrlPaths.get(value);
    if (existingPath) {
      return toStoragePhotoUrl(existingPath);
    }

    const index = uploadIndex.current;
    uploadIndex.current += 1;
    const extension = getDataUrlExtension(value);
    const path = `handoffs/${sanitizePathSegment(token)}/${index}.${extension}`;
    const response = await fetch(value);
    const blob = await response.blob();
    const { error } = await supabase.storage.from(CAT_PHOTOS_BUCKET).upload(
      path,
      blob,
      {
        cacheControl: "3600",
        contentType: blob.type || "image/jpeg",
        upsert: true,
      },
    );

    if (error) {
      throw new Error("data_url_upload_failed");
    }

    dataUrlPaths.set(value, path);
    return toStoragePhotoUrl(path);
  }

  if (Array.isArray(value)) {
    const nextItems = value.slice(0, MAX_ARRAY_ITEMS);
    return Promise.all(
      nextItems.map((item) =>
        persistDataUrls({
          value: item,
          token,
          supabase,
          depth: depth + 1,
          uploadIndex,
          dataUrlPaths,
        }),
      ),
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    );
    const next: Record<string, unknown> = {};

    for (const [key, item] of entries) {
      next[key] = await persistDataUrls({
        value: item,
        token,
        supabase,
        depth: depth + 1,
        uploadIndex,
        dataUrlPaths,
      });
    }

    return next;
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return null;
}

function createHandoffToken() {
  // randomUUID plus 18 crypto-random bytes keeps handoff URLs unguessable.
  const random = crypto.getRandomValues(new Uint8Array(18));
  const suffix = Array.from(random, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `onb_${crypto.randomUUID()}_${suffix}`;
}

function isAllowedImageDataUrl(value: string) {
  return /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(
    value,
  );
}

function getJsonByteLength(value: unknown) {
  try {
    return getUtf8ByteLength(JSON.stringify(value));
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function checkHandoffCreateRateLimit(request: Request) {
  const key = readClientIp(request);
  const now = Date.now();
  pruneRateLimitBuckets(now);

  const existing = rateLimitBuckets.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  return bucket.count <= RATE_LIMIT_MAX_REQUESTS;
}

function readClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function pruneRateLimitBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }

  if (rateLimitBuckets.size <= RATE_LIMIT_MAX_BUCKETS) {
    return;
  }

  for (const key of rateLimitBuckets.keys()) {
    rateLimitBuckets.delete(key);
    if (rateLimitBuckets.size <= RATE_LIMIT_MAX_BUCKETS) {
      break;
    }
  }
}
