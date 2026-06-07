import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireBetaFeedbackAccess } from "../../../../lib/betaAccess";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

type FeedbackCategory =
  | "good"
  | "confusing"
  | "bug"
  | "request"
  | "other";

type FeedbackKind = "beta_feedback" | "supporter_voice";

type FeedbackRequest = {
  category?: unknown;
  message?: unknown;
  kind?: unknown;
  page?: unknown;
  currentPath?: unknown;
  userAgent?: unknown;
};

type RateLimitBucket = {
  minuteStartedAt: number;
  minuteCount: number;
  hourStartedAt: number;
  hourCount: number;
  updatedAt: number;
};

const MAX_BODY_LENGTH = 12 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_META_LENGTH = 500;
const RATE_LIMIT_PER_MINUTE = 3;
const RATE_LIMIT_PER_HOUR = 20;
const RATE_LIMIT_WINDOW_MINUTE_MS = 60 * 1000;
const RATE_LIMIT_WINDOW_HOUR_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_BUCKETS = 1000;
const allowedCategories = new Set<FeedbackCategory>([
  "good",
  "confusing",
  "bug",
  "request",
  "other",
]);
const feedbackRateLimitBuckets = new Map<string, RateLimitBucket>();

export async function POST(request: Request) {
  const parsedBody = await readFeedbackRequest(request);

  if (!parsedBody.ok) {
    return feedbackError(parsedBody.error, parsedBody.status);
  }

  const { body } = parsedBody;
  const kind = readFeedbackKind(body.kind);
  const access = await requireBetaFeedbackAccess(request, kind);

  if (!access.allowed) {
    return feedbackError(access.error, access.status);
  }

  const category = readFeedbackCategory(body.category);
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!category || !message || message.length > MAX_MESSAGE_LENGTH) {
    return feedbackError("invalid_feedback", 400);
  }

  const rateLimit = checkFeedbackRateLimit(access.user.id);

  if (!rateLimit.allowed) {
    return feedbackError("too_many_requests", 429);
  }

  const supabase = await createFeedbackSupabaseClient(request);

  if (!supabase) {
    return feedbackError("server_unavailable", 503);
  }

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: access.user.id,
    category,
    message,
    kind,
    page: readOptionalString(body.page ?? body.currentPath),
    user_agent: readOptionalString(body.userAgent ?? request.headers.get("user-agent")),
    status: "new",
  });

  if (error) {
    return feedbackError("feedback_save_failed", 500);
  }

  return NextResponse.json({ ok: true });
}

async function readFeedbackRequest(
  request: Request,
): Promise<
  | { ok: true; body: FeedbackRequest }
  | {
      ok: false;
      status: 400 | 413;
      error: "invalid_json" | "payload_too_large";
    }
> {
  const rawBody = await request.text().catch(() => "");

  if (rawBody.length > MAX_BODY_LENGTH) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  try {
    return { ok: true, body: JSON.parse(rawBody || "{}") as FeedbackRequest };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}

function readFeedbackKind(value: unknown): FeedbackKind {
  return value === "supporter_voice" ? "supporter_voice" : "beta_feedback";
}

function readFeedbackCategory(value: unknown): FeedbackCategory | null {
  return typeof value === "string" && allowedCategories.has(value as FeedbackCategory)
    ? (value as FeedbackCategory)
    : null;
}

function readOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, MAX_META_LENGTH) : null;
}

function checkFeedbackRateLimit(key: string) {
  const now = Date.now();
  const existing = feedbackRateLimitBuckets.get(key);
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
  feedbackRateLimitBuckets.set(key, bucket);
  pruneFeedbackRateLimitBuckets(now);

  return {
    allowed:
      bucket.minuteCount <= RATE_LIMIT_PER_MINUTE &&
      bucket.hourCount <= RATE_LIMIT_PER_HOUR,
  };
}

async function createFeedbackSupabaseClient(
  request: Request,
): Promise<SupabaseClient | null> {
  const adminClient = createSupabaseAdminClient();

  if (adminClient) {
    return adminClient;
  }

  const bearerToken = readBearerToken(request);
  const config = getSupabasePublicConfig();

  if (bearerToken && config) {
    return createClient(config.url, config.anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return createServerSupabaseClient();
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();

  return token || null;
}

function pruneFeedbackRateLimitBuckets(now: number) {
  if (feedbackRateLimitBuckets.size <= RATE_LIMIT_MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of feedbackRateLimitBuckets) {
    if (now - bucket.updatedAt > RATE_LIMIT_WINDOW_HOUR_MS * 2) {
      feedbackRateLimitBuckets.delete(key);
    }
  }
}

function feedbackError(error: string, status: 400 | 401 | 403 | 413 | 429 | 500 | 503) {
  return NextResponse.json({ ok: false, error }, { status });
}
