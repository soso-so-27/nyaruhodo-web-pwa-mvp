export type OnboardingChoiceOperation = "keep" | "skip";

export type OnboardingChoiceCanonicalResult = {
  state: "kept" | "skipped" | "expired";
  selectedPhotoId: string | null;
  resolvedAt: string;
  conflict: boolean;
};

const ONBOARDING_CHOICE_TIMEOUT_MS = 15_000;

export async function finalizeOnboardingDeliveryChoice({
  bundleId,
  deliveryDateKey,
  journeyId,
  operation,
  resumeToken,
  selectedPhotoId,
  submissionId,
}: {
  bundleId: string;
  deliveryDateKey: string;
  journeyId: string;
  operation: OnboardingChoiceOperation;
  resumeToken: string;
  selectedPhotoId: string | null;
  submissionId: string;
}): Promise<OnboardingChoiceCanonicalResult | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort("choice_timeout"),
    ONBOARDING_CHOICE_TIMEOUT_MS,
  );

  try {
    const response = await fetch("/api/onboarding/choice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        bundleId,
        deliveryDateKey,
        journeyId,
        operation,
        resumeToken,
        selectedPhotoId: operation === "keep" ? selectedPhotoId : null,
        submissionId,
      }),
    });

    if (response.status !== 200 && response.status !== 409) {
      return null;
    }

    const body = (await response.json()) as {
      state?: unknown;
      selectedPhotoId?: unknown;
      resolvedAt?: unknown;
      canonical?: {
        state?: unknown;
        selectedPhotoId?: unknown;
        resolvedAt?: unknown;
      };
    };
    const canonical = response.status === 409 ? body.canonical : body;
    if (!isOnboardingChoiceCanonical(canonical)) {
      return null;
    }

    return {
      state: canonical.state,
      selectedPhotoId: canonical.selectedPhotoId,
      resolvedAt: canonical.resolvedAt,
      conflict: response.status === 409,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function isOnboardingChoiceCanonical(value: unknown): value is {
  state: "kept" | "skipped" | "expired";
  selectedPhotoId: string | null;
  resolvedAt: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const canonical = value as Record<string, unknown>;
  const state = canonical.state;
  const selectedPhotoId = canonical.selectedPhotoId;

  return (
    (state === "kept" || state === "skipped" || state === "expired") &&
    typeof canonical.resolvedAt === "string" &&
    (selectedPhotoId === null || typeof selectedPhotoId === "string") &&
    (state !== "kept" || typeof selectedPhotoId === "string")
  );
}
