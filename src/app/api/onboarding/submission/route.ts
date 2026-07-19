import { NextResponse } from "next/server";

import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import {
  isOnboardingResumeToken,
  isOnboardingServerStage,
  type OnboardingSubmissionAdvanceInput,
} from "../../../../lib/onboarding/submissionContract";
import {
  createOnboardingJourneySubmissionId,
  createOnboardingOwnPhotoId,
  isOnboardingJourneyId,
} from "../../../../lib/onboarding/journeyContract";
import {
  advanceOnboardingSubmission,
  readOnboardingSubmission,
} from "../../../../lib/server/onboardingSubmissionLedger";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_REQUESTS_PER_HOUR = 180;
const MAX_RATE_LIMIT_BUCKETS = 1000;
const rateLimitBuckets = new Map<
  string,
  {
    hourCount: number;
    hourStartedAt: number;
    minuteCount: number;
    minuteStartedAt: number;
    updatedAt: number;
  }
>();

export async function PUT(request: Request) {
  const rateLimit = checkRateLimit(request);
  if (!rateLimit.allowed) {
    return errorResponse("too_many_requests", 429);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return errorResponse(parsed.error, parsed.status);
  }

  const input = normalizeAdvanceInput(parsed.body);
  if (!input) {
    return errorResponse("invalid_submission", 400);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return errorResponse("submission_store_unavailable", 503);
  }

  const user = await getAuthenticatedUserForRequest(request);
  if (!user?.id && !input.anonymousId) {
    return errorResponse("missing_identity", 400);
  }

  const result = await advanceOnboardingSubmission({
    input,
    supabase,
    userId: user?.id ?? null,
  });

  if (!result.ok) {
    if (result.error === "forbidden") {
      return errorResponse("submission_not_found", 404);
    }
    if (result.error === "conflict") {
      return errorResponse("submission_conflict", 409);
    }
    return errorResponse("submission_store_failed", 500);
  }

  return NextResponse.json({ ok: true, submission: result.status });
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request);
  if (!rateLimit.allowed) {
    return errorResponse("too_many_requests", 429);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return errorResponse(parsed.error, parsed.status);
  }

  const body = parsed.body as Record<string, unknown>;
  const submissionId = normalizeSubmissionId(body.submissionId);
  const resumeToken = body.resumeToken;

  if (!submissionId || !isOnboardingResumeToken(resumeToken)) {
    return errorResponse("invalid_submission", 400);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return errorResponse("submission_store_unavailable", 503);
  }

  const result = await readOnboardingSubmission({
    resumeToken,
    submissionId,
    supabase,
  });

  if (!result.ok) {
    return result.error === "not_found"
      ? errorResponse("submission_not_found", 404)
      : errorResponse("submission_store_failed", 500);
  }

  return NextResponse.json({ ok: true, submission: result.status });
}

function normalizeAdvanceInput(body: unknown): OnboardingSubmissionAdvanceInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const value = body as Record<string, unknown>;
  const submissionId = normalizeSubmissionId(value.submissionId);
  const anonymousId = normalizeOptionalId(value.anonymousId, 128);
  const ownPhotoId = normalizeOptionalId(value.ownPhotoId, 240);
  const deliveryId = normalizeOptionalId(value.deliveryId, 240);
  const sourcePhotoId = normalizeOptionalId(value.sourcePhotoId, 240);
  const journeyId = normalizeOptionalId(value.journeyId, 160);
  const source = normalizeSource(value.source);
  const dateKey = normalizeDateKey(value.dateKey);

  if (
    !submissionId ||
    !dateKey ||
    !source ||
    !isOnboardingResumeToken(value.resumeToken) ||
    !isOnboardingServerStage(value.stage) ||
    anonymousId === undefined ||
    ownPhotoId === undefined ||
    deliveryId === undefined ||
    sourcePhotoId === undefined ||
    journeyId === undefined ||
    (journeyId !== null &&
      (!isOnboardingJourneyId(journeyId) ||
        submissionId !==
          createOnboardingJourneySubmissionId(journeyId, dateKey) ||
        (ownPhotoId !== null &&
          ownPhotoId !== createOnboardingOwnPhotoId(submissionId))))
  ) {
    return null;
  }

  return {
    anonymousId,
    dateKey,
    deliveryId,
    journeyId,
    ownPhotoId,
    resumeToken: value.resumeToken,
    source,
    sourcePhotoId,
    stage: value.stage,
    submissionId,
  };
}

async function readJsonBody(request: Request): Promise<
  | { ok: true; body: unknown }
  | { ok: false; error: "invalid_json" | "payload_too_large"; status: 400 | 413 }
> {
  const raw = await request.text().catch(() => "");
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, error: "payload_too_large", status: 413 };
  }

  try {
    return { ok: true, body: JSON.parse(raw || "{}") as unknown };
  } catch {
    return { ok: false, error: "invalid_json", status: 400 };
  }
}

function normalizeSubmissionId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 240 ? normalized : null;
}

function normalizeOptionalId(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength
    ? normalized
    : undefined;
}

function normalizeDateKey(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function normalizeSource(value: unknown) {
  return typeof value === "string" &&
    [
      "direct",
      "instagram",
      "instagram_story",
      "instagram_bio",
      "instagram_dm",
      "referral",
      "unknown",
    ].includes(value)
    ? value
    : null;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function checkRateLimit(request: Request) {
  const now = Date.now();
  const key = `ip:${readClientIp(request)}`;
  const existing = rateLimitBuckets.get(key);
  const minuteExpired = !existing || now - existing.minuteStartedAt >= 60_000;
  const hourExpired = !existing || now - existing.hourStartedAt >= 3_600_000;
  const bucket = {
    minuteStartedAt: minuteExpired ? now : existing.minuteStartedAt,
    minuteCount: minuteExpired ? 1 : existing.minuteCount + 1,
    hourStartedAt: hourExpired ? now : existing.hourStartedAt,
    hourCount: hourExpired ? 1 : existing.hourCount + 1,
    updatedAt: now,
  };
  rateLimitBuckets.set(key, bucket);
  pruneRateLimitBuckets(now);

  return {
    allowed:
      bucket.minuteCount <= MAX_REQUESTS_PER_MINUTE &&
      bucket.hourCount <= MAX_REQUESTS_PER_HOUR,
  };
}

function readClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function pruneRateLimitBuckets(now: number) {
  if (rateLimitBuckets.size <= MAX_RATE_LIMIT_BUCKETS) {
    return;
  }

  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.updatedAt > 7_200_000) {
      rateLimitBuckets.delete(key);
    }
  }
}
