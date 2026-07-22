import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { checkExchangeRateLimit } from "../../../../lib/home/sleepingDeliveryRequestGuards";
import {
  createOnboardingJourneySubmissionId,
  isOnboardingJourneyId,
} from "../../../../lib/onboarding/journeyContract";
import { isOnboardingResumeToken } from "../../../../lib/onboarding/submissionContract";
import { buildOnboardingJourneyDeliveryId } from "../../../../lib/server/onboardingDeliveryBundle";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 4_096;
const MAX_ID_LENGTH = 240;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ChoiceRequest = {
  bundleId?: unknown;
  deliveryDateKey?: unknown;
  journeyId?: unknown;
  resumeToken?: unknown;
  selectedPhotoId?: unknown;
  submissionId?: unknown;
};

type ChoiceResolutionRow = {
  outcome: "kept";
  selected_local_delivery_id: string;
  resolved_at: string;
  applied: boolean;
};

export async function POST(request: Request) {
  const parsed = await readChoiceRequest(request);
  if (!parsed.ok) {
    return choiceError(parsed.error, parsed.status);
  }

  const bundleId = sanitizeId(parsed.input.bundleId);
  const deliveryDateKey = sanitizeDateKey(parsed.input.deliveryDateKey);
  const journeyId = sanitizeId(parsed.input.journeyId);
  const resumeToken = sanitizeId(parsed.input.resumeToken);
  const selectedPhotoId = sanitizeId(parsed.input.selectedPhotoId);
  const submissionId = sanitizeId(parsed.input.submissionId);

  if (
    !bundleId ||
    !deliveryDateKey ||
    !journeyId ||
    !isOnboardingJourneyId(journeyId) ||
    !resumeToken ||
    !isOnboardingResumeToken(resumeToken) ||
    !submissionId ||
    submissionId !==
      createOnboardingJourneySubmissionId(journeyId, deliveryDateKey) ||
    bundleId !==
      buildOnboardingJourneyDeliveryId({ journeyId, deliveryDateKey }) ||
    !isBundleChoiceId(selectedPhotoId, bundleId)
  ) {
    return choiceError("invalid_choice_request", 400);
  }

  if (!checkExchangeRateLimit(`onboarding-choice:${submissionId}`).allowed) {
    return choiceError("too_many_requests", 429);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return choiceError("server_unavailable", 503);
  }

  const { data, error } = await supabase.rpc(
    "finalize_onboarding_delivery_choice",
    {
      p_submission_id: submissionId,
      p_resume_token_hash: createHash("sha256")
        .update(resumeToken)
        .digest("hex"),
      p_bundle_id: bundleId,
      p_selected_local_delivery_id: selectedPhotoId,
    },
  );

  if (error) {
    const message = error.message ?? "";
    if (/onboarding_submission_forbidden/i.test(message)) {
      return choiceError("onboarding_submission_forbidden", 403);
    }
    if (/choice_bundle_not_found/i.test(message)) {
      return choiceError("choice_bundle_not_found", 404);
    }
    if (/invalid_(?:choice_request|selection)/i.test(message)) {
      return choiceError("invalid_choice_request", 422);
    }
    console.warn("[onboarding/choice] finalize failed", { code: error.code });
    return choiceError("choice_unavailable", 503);
  }

  const resolution = (data?.[0] ?? null) as ChoiceResolutionRow | null;
  if (!resolution || !isChoiceResolutionRow(resolution)) {
    return choiceError("choice_unavailable", 503);
  }

  const canonical = {
    state: resolution.outcome,
    selectedPhotoId: resolution.selected_local_delivery_id,
    resolvedAt: resolution.resolved_at,
  };

  if (resolution.selected_local_delivery_id !== selectedPhotoId) {
    return NextResponse.json(
      {
        ok: false,
        error: "choice_already_resolved",
        canonical,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    ...canonical,
    idempotent: !resolution.applied,
  });
}

async function readChoiceRequest(request: Request) {
  const rawBody = await request.text().catch(() => "");
  if (rawBody.length > MAX_BODY_LENGTH) {
    return {
      ok: false as const,
      status: 413 as const,
      error: "payload_too_large",
    };
  }

  try {
    const input = JSON.parse(rawBody) as ChoiceRequest;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("invalid body");
    }
    return { ok: true as const, input };
  } catch {
    return {
      ok: false as const,
      status: 400 as const,
      error: "invalid_choice_request",
    };
  }
}

function sanitizeId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ID_LENGTH || /[\r\n]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function sanitizeDateKey(value: unknown) {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value)
    ? value
    : null;
}

function isBundleChoiceId(photoId: string | null, bundleId: string) {
  return Boolean(
    photoId &&
      [1, 2, 3, 4].some(
        (position) => photoId === `${bundleId}-choice-${position}`,
      ),
  );
}

function isChoiceResolutionRow(value: ChoiceResolutionRow) {
  return (
    value.outcome === "kept" &&
    typeof value.selected_local_delivery_id === "string" &&
    typeof value.resolved_at === "string" &&
    typeof value.applied === "boolean"
  );
}

function choiceError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}
