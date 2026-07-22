import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import { checkExchangeRateLimit } from "../../../../lib/home/sleepingDeliveryRequestGuards";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 4_096;
const MAX_ID_LENGTH = 160;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ChoiceRequest = {
  operation?: unknown;
  bundleId?: unknown;
  deliveryDateKey?: unknown;
  selectedPhotoId?: unknown;
  anonymousId?: unknown;
};

type ChoiceResolutionRow = {
  outcome: "kept" | "skipped" | "expired";
  selected_local_delivery_id: string | null;
  resolved_at: string;
  applied: boolean;
};

export async function POST(request: Request) {
  const parsed = await readChoiceRequest(request);
  if (!parsed.ok) {
    return choiceError(parsed.error, parsed.status);
  }

  const operation = parsed.input.operation;
  const bundleId = sanitizeId(parsed.input.bundleId);
  const deliveryDateKey = sanitizeDateKey(parsed.input.deliveryDateKey);
  const selectedPhotoId = sanitizeId(parsed.input.selectedPhotoId);
  const requestedAnonymousId = sanitizeId(parsed.input.anonymousId);

  if (
    (operation !== "keep" && operation !== "skip") ||
    !bundleId ||
    !deliveryDateKey ||
    (operation === "keep" && !isBundleChoiceId(selectedPhotoId, bundleId)) ||
    (operation === "skip" && selectedPhotoId)
  ) {
    return choiceError("invalid_choice_request", 400);
  }

  const user = await getAuthenticatedUserForRequest(request);
  const userId =
    user &&
    bundleId ===
      buildExpectedBundleId({
        userId: user.id,
        anonymousId: null,
        deliveryDateKey,
      })
      ? user.id
      : null;
  const anonymousId =
    !userId &&
    requestedAnonymousId &&
    bundleId ===
      buildExpectedBundleId({
        userId: null,
        anonymousId: requestedAnonymousId,
        deliveryDateKey,
      })
      ? requestedAnonymousId
      : null;

  if (!userId && !anonymousId) {
    return choiceError("invalid_identity", 400);
  }

  if (
    !checkExchangeRateLimit(
      userId ? `choice:user:${userId}` : `choice:anon:${anonymousId}`,
    ).allowed
  ) {
    return choiceError("too_many_requests", 429);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return choiceError("server_unavailable", 503);
  }

  const { data, error } = await supabase.rpc(
    "finalize_evening_delivery_choice",
    {
      p_user_id: userId,
      p_anonymous_id: anonymousId,
      p_bundle_id: bundleId,
      p_delivery_date_key: deliveryDateKey,
      p_outcome: operation === "keep" ? "kept" : "skipped",
      p_selected_local_delivery_id:
        operation === "keep" ? selectedPhotoId : null,
    },
  );

  if (error) {
    const message = error.message ?? "";
    if (/bundle_not_found/i.test(message)) {
      return choiceError("choice_bundle_not_found", 404);
    }
    if (/invalid_(?:identity|bundle|outcome|selection)/i.test(message)) {
      return choiceError("invalid_choice_request", 422);
    }
    console.warn("[sleeping-delivery/choice] finalize failed", {
      code: error.code,
    });
    return choiceError("choice_unavailable", 503);
  }

  const resolution = (data?.[0] ?? null) as ChoiceResolutionRow | null;
  if (!resolution || !isChoiceResolutionRow(resolution)) {
    return choiceError("choice_unavailable", 503);
  }

  const effectiveResolution = await readEffectiveChoiceResolution({
    supabase,
    resolution,
    userId,
    anonymousId,
  });
  if (!effectiveResolution) {
    return choiceError("choice_unavailable", 503);
  }

  const requestedOutcome = operation === "keep" ? "kept" : "skipped";
  const isSameResolution =
    effectiveResolution.outcome === requestedOutcome &&
    (effectiveResolution.outcome !== "kept" ||
      effectiveResolution.selected_local_delivery_id === selectedPhotoId);
  const canonical = {
    state: effectiveResolution.outcome,
    selectedPhotoId: effectiveResolution.selected_local_delivery_id,
    resolvedAt: effectiveResolution.resolved_at,
  };

  if (!isSameResolution) {
    return NextResponse.json(
      {
        ok: false,
        error:
          effectiveResolution.outcome === "expired"
            ? "choice_expired"
            : "choice_already_resolved",
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

async function readEffectiveChoiceResolution({
  supabase,
  resolution,
  userId,
  anonymousId,
}: {
  supabase: SupabaseClient;
  resolution: ChoiceResolutionRow;
  userId: string | null;
  anonymousId: string | null;
}) {
  if (
    resolution.outcome !== "kept" ||
    !resolution.selected_local_delivery_id
  ) {
    return resolution;
  }

  let query = supabase
    .from("cat_moment_deliveries")
    .select("status")
    .eq("local_delivery_id", resolution.selected_local_delivery_id)
    .limit(1);
  query = userId
    ? query.eq("user_id", userId)
    : query.is("user_id", null).eq("anonymous_id", anonymousId ?? "");

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn("[sleeping-delivery/choice] status verification failed", {
      code: error.code,
    });
    return null;
  }

  if (data?.status === "kept") {
    return resolution;
  }

  return {
    ...resolution,
    outcome: "skipped" as const,
    selected_local_delivery_id: null,
  };
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

function buildExpectedBundleId({
  userId,
  anonymousId,
  deliveryDateKey,
}: {
  userId: string | null;
  anonymousId: string | null;
  deliveryDateKey: string;
}) {
  const identity = userId ? `user:${userId}` : `anon:${anonymousId ?? ""}`;
  const digest = createHash("sha256")
    .update(`${identity}:${deliveryDateKey}`)
    .digest("hex")
    .slice(0, 24);
  return `delivered-sleeping-${deliveryDateKey}-${digest}`;
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
    (value.outcome === "kept" ||
      value.outcome === "skipped" ||
      value.outcome === "expired") &&
    typeof value.resolved_at === "string" &&
    typeof value.applied === "boolean" &&
    (value.selected_local_delivery_id === null ||
      typeof value.selected_local_delivery_id === "string")
  );
}

function choiceError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}
