import { getStoragePhotoPath } from "../photoStorage";
import {
  isOwnStoragePath,
  isSafeStoragePath,
} from "../photoStorageAuthorization";

export type SleepingDeliveryValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 400 | 401 | 403 | 413 | 415;
      error:
        | "invalid_exchange_request"
        | "payload_too_large"
        | "auth_required"
        | "forbidden_photo"
        | "unsupported_media_type";
    };

type RateLimitBucket = {
  minuteStartedAt: number;
  minuteCount: number;
  hourStartedAt: number;
  hourCount: number;
  updatedAt: number;
};

export const MAX_OWN_PHOTO_SRC_LENGTH = 2 * 1024 * 1024;
export const MAX_OWN_PHOTO_BYTES = 1536 * 1024;

const RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_PER_HOUR = 60;
const RATE_LIMIT_WINDOW_MINUTE_MS = 60 * 1000;
const RATE_LIMIT_WINDOW_HOUR_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_BUCKETS = 1000;
const exchangeRateLimitBuckets = new Map<string, RateLimitBucket>();

export function validateOwnPhotoSrc(src: string): SleepingDeliveryValidationResult {
  const storagePath = getStoragePhotoPath(src);

  if (storagePath !== null) {
    return validateOwnPhotoStoragePath(storagePath);
  }

  if (!src || !src.startsWith("data:")) {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }

  if (src.length > MAX_OWN_PHOTO_SRC_LENGTH) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const match = src.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/]+={0,2})$/,
  );

  if (!match) {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }

  const mime = match[1];
  const base64 = match[2];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;

  if (base64.length % 4 !== 0 || byteLength <= 0) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (byteLength > MAX_OWN_PHOTO_BYTES) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const header = Buffer.from(base64.slice(0, 32), "base64");

  if (!hasExpectedImageMagicNumber(mime, header)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return { ok: true };
}

export function validateOwnStoragePhotoPathAccess(
  storagePath: string,
  userId: string | null,
): SleepingDeliveryValidationResult {
  if (!isSafeStoragePath(storagePath)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (!userId) {
    return { ok: false, status: 401, error: "auth_required" };
  }

  if (!isOwnStoragePath(storagePath, userId)) {
    return { ok: false, status: 403, error: "forbidden_photo" };
  }

  return { ok: true };
}

export function buildSleepingDeliveryRateLimitKey(
  request: Request,
  anonymousId: string | null,
) {
  if (anonymousId) {
    return `anon:${anonymousId}`;
  }

  return `ip:${readClientIp(request)}`;
}

export function checkExchangeRateLimit(key: string) {
  const now = Date.now();
  const existing = exchangeRateLimitBuckets.get(key);
  const bucket: RateLimitBucket = existing
    ? {
        minuteStartedAt:
          now - existing.minuteStartedAt > RATE_LIMIT_WINDOW_MINUTE_MS
            ? now
            : existing.minuteStartedAt,
        minuteCount:
          now - existing.minuteStartedAt > RATE_LIMIT_WINDOW_MINUTE_MS
            ? 0
            : existing.minuteCount,
        hourStartedAt:
          now - existing.hourStartedAt > RATE_LIMIT_WINDOW_HOUR_MS
            ? now
            : existing.hourStartedAt,
        hourCount:
          now - existing.hourStartedAt > RATE_LIMIT_WINDOW_HOUR_MS
            ? 0
            : existing.hourCount,
        updatedAt: now,
      }
    : {
        minuteStartedAt: now,
        minuteCount: 0,
        hourStartedAt: now,
        hourCount: 0,
        updatedAt: now,
      };

  bucket.minuteCount += 1;
  bucket.hourCount += 1;
  exchangeRateLimitBuckets.set(key, bucket);
  pruneRateLimitBuckets(now);

  return {
    allowed:
      bucket.minuteCount <= RATE_LIMIT_PER_MINUTE &&
      bucket.hourCount <= RATE_LIMIT_PER_HOUR,
  };
}

function validateOwnPhotoStoragePath(
  path: string,
): SleepingDeliveryValidationResult {
  if (!isSafeStoragePath(path)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return { ok: true };
}

function hasExpectedImageMagicNumber(mime: string, header: Buffer) {
  if (mime === "image/jpeg") {
    return header[0] === 0xff && header[1] === 0xd8;
  }

  if (mime === "image/png") {
    return (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    );
  }

  if (mime === "image/webp") {
    return (
      header.toString("ascii", 0, 4) === "RIFF" &&
      header.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
}

function readClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function pruneRateLimitBuckets(now: number) {
  if (exchangeRateLimitBuckets.size <= RATE_LIMIT_MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of exchangeRateLimitBuckets) {
    if (now - bucket.updatedAt > RATE_LIMIT_WINDOW_HOUR_MS * 2) {
      exchangeRateLimitBuckets.delete(key);
    }
  }
}
