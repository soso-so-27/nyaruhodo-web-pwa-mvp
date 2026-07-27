import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthenticatedUserForRequest } from "../../../lib/adminAccess";
import {
  checkExchangeRateLimit,
  readSleepingDeliveryClientIp,
} from "../../../lib/home/sleepingDeliveryRequestGuards";
import { isOnboardingResumeToken } from "../../../lib/onboarding/submissionContract";
import { readOnboardingSubmission } from "../../../lib/server/onboardingSubmissionLedger";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 16_384;
const MAX_SOURCE_MOMENT_IDS = 100;
const MAX_SUBMISSION_ID_LENGTH = 240;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

type FeedbackRequest = {
  onboarding?: unknown;
  sourceMomentIds?: unknown;
};

type OnboardingCapability = {
  resumeToken: string;
  submissionId: string;
};

type OwnedMomentRow = {
  id: string;
  local_moment_id: string;
};

type DeliveryRow = {
  anonymous_id: string | null;
  local_delivery_id: string;
  metadata: Record<string, unknown> | null;
  source_moment_id: string | null;
  status: string;
  user_id: string | null;
};

type EveningResolutionRow = {
  anonymous_id: string | null;
  outcome: string;
  selected_local_delivery_id: string | null;
  user_id: string | null;
};

type OnboardingResolutionRow = {
  anonymous_id: string | null;
  delivery_choice_outcome: string | null;
  delivery_id: string | null;
  submission_id: string;
  user_id: string | null;
};

type SourceOwnerFeedbackState = "delivered" | "selected";

export async function POST(request: Request) {
  const parsed = await readFeedbackRequest(request);
  if (!parsed.ok) {
    return feedbackError(parsed.error, parsed.status);
  }

  const sourceMomentIds = sanitizeSourceMomentIds(
    parsed.input.sourceMomentIds,
  );
  if (!sourceMomentIds) {
    return feedbackError("invalid_feedback_request", 400);
  }

  const onboarding = sanitizeOnboardingCapability(parsed.input.onboarding);
  if (parsed.input.onboarding !== undefined && !onboarding) {
    return feedbackError("invalid_feedback_request", 400);
  }

  const user = await getAuthenticatedUserForRequest(request);
  if (!user && !onboarding) {
    return feedbackError("auth_required", 401);
  }

  const rateLimitKeys = [
    user
      ? `source-owner-feedback:user:${user.id}`
      : `source-owner-feedback:submission:${onboarding?.submissionId ?? "none"}`,
    `source-owner-feedback:ip:${readSleepingDeliveryClientIp(request)}`,
  ];
  if (
    rateLimitKeys.some((key) => !checkExchangeRateLimit(key).allowed)
  ) {
    return feedbackError("too_many_requests", 429);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return feedbackError("server_unavailable", 503);
  }

  const ownedMomentMap = new Map<string, OwnedMomentRow>();

  if (user && sourceMomentIds.length > 0) {
    const { data, error } = await supabase
      .from("cat_moments")
      .select("id, local_moment_id")
      .eq("user_id", user.id)
      .in("id", sourceMomentIds);

    if (error) {
      console.warn("[cat-moment-feedback] owner lookup failed", {
        code: error.code,
      });
      return feedbackError("feedback_unavailable", 503);
    }

    for (const row of (data ?? []) as OwnedMomentRow[]) {
      ownedMomentMap.set(row.id, row);
    }
  }

  if (onboarding) {
    const capabilityResult = await readOnboardingSubmission({
      resumeToken: onboarding.resumeToken,
      submissionId: onboarding.submissionId,
      supabase,
    });

    if (!capabilityResult.ok) {
      if (!user) {
        return feedbackError(
          capabilityResult.error === "store_failed"
            ? "feedback_unavailable"
            : "feedback_not_found",
          capabilityResult.error === "store_failed" ? 503 : 404,
        );
      }
    } else if (capabilityResult.status.ownPhotoId) {
      const { data, error } = await supabase
        .from("cat_moments")
        .select("id, local_moment_id")
        .eq("local_moment_id", capabilityResult.status.ownPhotoId)
        .contains("metadata", {
          onboarding_submission_id: onboarding.submissionId,
        });

      if (error) {
        console.warn("[cat-moment-feedback] onboarding owner lookup failed", {
          code: error.code,
        });
        if (!user) {
          return feedbackError("feedback_unavailable", 503);
        }
      } else {
        for (const row of (data ?? []) as OwnedMomentRow[]) {
          ownedMomentMap.set(row.id, row);
        }
      }
    }
  }

  if (ownedMomentMap.size === 0) {
    return feedbackResponse([]);
  }

  const feedback = await readFeedbackForOwnedMoments(
    supabase,
    [...ownedMomentMap.values()],
  );
  if (!feedback.ok) {
    return feedbackError("feedback_unavailable", 503);
  }

  return feedbackResponse(feedback.items);
}

async function readFeedbackForOwnedMoments(
  supabase: SupabaseClient,
  ownedMoments: OwnedMomentRow[],
) {
  const momentIds = ownedMoments.map((moment) => moment.id);
  const { data, error } = await supabase
    .from("cat_moment_deliveries")
    .select(
      "user_id, anonymous_id, local_delivery_id, source_moment_id, status, metadata",
    )
    .in("source_moment_id", momentIds);

  if (error) {
    console.warn("[cat-moment-feedback] delivery lookup failed", {
      code: error.code,
    });
    return { ok: false as const };
  }

  const deliveries = ((data ?? []) as DeliveryRow[]).filter(
    (delivery) =>
      delivery.source_moment_id &&
      ownedMoments.some((moment) => moment.id === delivery.source_moment_id),
  );
  if (deliveries.length === 0) {
    return { ok: true as const, items: [] };
  }

  const selectedMomentIds = await readExplicitlySelectedMomentIds(
    supabase,
    deliveries,
  );
  if (!selectedMomentIds) {
    return { ok: false as const };
  }

  const deliveredMomentIds = new Set(
    deliveries
      .map((delivery) => delivery.source_moment_id)
      .filter((id): id is string => Boolean(id)),
  );
  const items = ownedMoments.flatMap((moment) => {
    if (!deliveredMomentIds.has(moment.id)) {
      return [];
    }

    const state: SourceOwnerFeedbackState = selectedMomentIds.has(moment.id)
      ? "selected"
      : "delivered";

    return [
      {
        sourceMomentId: moment.id,
        localPhotoId: moment.local_moment_id,
        state,
      },
    ];
  });

  return { ok: true as const, items };
}

async function readExplicitlySelectedMomentIds(
  supabase: SupabaseClient,
  deliveries: DeliveryRow[],
) {
  const selectedMomentIds = new Set<string>();
  const eveningDeliveries = deliveries.filter(
    (delivery) =>
      readMetadataText(delivery.metadata, "experience_version") ===
      "evening_choice_v1",
  );
  const onboardingDeliveries = deliveries.filter(
    (delivery) =>
      readMetadataText(delivery.metadata, "experience_version") ===
      "onboarding_choice_v1",
  );

  if (eveningDeliveries.length > 0) {
    const deliveryIds = uniqueStrings(
      eveningDeliveries.map((delivery) => delivery.local_delivery_id),
    );
    const { data, error } = await supabase
      .from("evening_delivery_choice_resolutions")
      .select(
        "user_id, anonymous_id, outcome, selected_local_delivery_id",
      )
      .eq("outcome", "kept")
      .in("selected_local_delivery_id", deliveryIds);

    if (error) {
      console.warn("[cat-moment-feedback] evening resolution lookup failed", {
        code: error.code,
      });
      return null;
    }

    for (const resolution of (data ?? []) as EveningResolutionRow[]) {
      if (
        resolution.outcome !== "kept" ||
        !resolution.selected_local_delivery_id
      ) {
        continue;
      }

      for (const delivery of eveningDeliveries) {
        if (
          delivery.local_delivery_id ===
            resolution.selected_local_delivery_id &&
          hasSameRecipient(delivery, resolution) &&
          delivery.source_moment_id
        ) {
          selectedMomentIds.add(delivery.source_moment_id);
        }
      }
    }
  }

  if (onboardingDeliveries.length > 0) {
    const deliveryIds = uniqueStrings(
      onboardingDeliveries.map((delivery) => delivery.local_delivery_id),
    );
    const { data, error } = await supabase
      .from("onboarding_submissions")
      .select(
        "user_id, anonymous_id, submission_id, delivery_id, delivery_choice_outcome",
      )
      .eq("delivery_choice_outcome", "kept")
      .in("delivery_id", deliveryIds);

    if (error) {
      console.warn("[cat-moment-feedback] onboarding resolution lookup failed", {
        code: error.code,
      });
      return null;
    }

    for (const resolution of (data ?? []) as OnboardingResolutionRow[]) {
      if (
        resolution.delivery_choice_outcome !== "kept" ||
        !resolution.delivery_id
      ) {
        continue;
      }

      for (const delivery of onboardingDeliveries) {
        if (
          delivery.local_delivery_id === resolution.delivery_id &&
          readMetadataText(
            delivery.metadata,
            "onboarding_submission_id",
          ) === resolution.submission_id &&
          hasSameRecipient(delivery, resolution) &&
          delivery.source_moment_id
        ) {
          selectedMomentIds.add(delivery.source_moment_id);
        }
      }
    }
  }

  return selectedMomentIds;
}

function hasSameRecipient(
  delivery: Pick<DeliveryRow, "anonymous_id" | "user_id">,
  resolution: { anonymous_id: string | null; user_id: string | null },
) {
  if (delivery.user_id) {
    return resolution.user_id === delivery.user_id;
  }

  return (
    resolution.user_id === null &&
    Boolean(delivery.anonymous_id) &&
    resolution.anonymous_id === delivery.anonymous_id
  );
}

async function readFeedbackRequest(request: Request) {
  const rawBody = await request.text().catch(() => "");
  if (rawBody.length > MAX_BODY_LENGTH) {
    return {
      ok: false as const,
      status: 413 as const,
      error: "payload_too_large",
    };
  }

  try {
    const input = JSON.parse(rawBody) as FeedbackRequest;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("invalid body");
    }
    return { ok: true as const, input };
  } catch {
    return {
      ok: false as const,
      status: 400 as const,
      error: "invalid_feedback_request",
    };
  }
}

function sanitizeSourceMomentIds(value: unknown) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > MAX_SOURCE_MOMENT_IDS) {
    return null;
  }

  const ids = uniqueStrings(
    value.filter(
      (candidate): candidate is string =>
        typeof candidate === "string" && UUID_PATTERN.test(candidate),
    ),
  );

  return ids.length === value.length ? ids : null;
}

function sanitizeOnboardingCapability(
  value: unknown,
): OnboardingCapability | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const submissionId =
    typeof input.submissionId === "string"
      ? input.submissionId.trim()
      : "";
  const resumeToken = input.resumeToken;

  if (
    !submissionId ||
    submissionId.length > MAX_SUBMISSION_ID_LENGTH ||
    /[\r\n]/.test(submissionId) ||
    !isOnboardingResumeToken(resumeToken)
  ) {
    return null;
  }

  return { submissionId, resumeToken };
}

function readMetadataText(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function feedbackResponse(
  feedback: Array<{
    sourceMomentId: string;
    localPhotoId: string;
    state: SourceOwnerFeedbackState;
  }>,
) {
  return NextResponse.json(
    { ok: true, feedback },
    { headers: NO_STORE_HEADERS },
  );
}

function feedbackError(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: NO_STORE_HEADERS },
  );
}
