import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 10;
const MAX_BUCKETS = 500;
const buckets = new Map<string, RateLimitBucket>();

export function checkAdminTaskRateLimit(request: Request, taskName: string) {
  const key = `${taskName}:${readClientIp(request)}`;
  const now = Date.now();
  pruneBuckets(now);

  const existing = buckets.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + WINDOW_MS };

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > MAX_REQUESTS) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  return null;
}

function readClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function pruneBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (buckets.size <= MAX_BUCKETS) {
      break;
    }
  }
}
