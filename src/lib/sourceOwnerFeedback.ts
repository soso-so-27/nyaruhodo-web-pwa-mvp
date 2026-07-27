import { createBrowserSupabaseClient } from "./supabase/browser";

export type SourceOwnerFeedbackState = "delivered" | "selected";

export type SourceOwnerFeedback = {
  sourceMomentId: string;
  localPhotoId: string;
  state: SourceOwnerFeedbackState;
};

export type SourceOwnerFeedbackOnboardingCapability = {
  submissionId: string;
  resumeToken: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SOURCE_MOMENT_IDS = 100;

export async function readSourceOwnerFeedback({
  sourceMomentIds = [],
  onboarding,
}: {
  sourceMomentIds?: string[];
  onboarding?: SourceOwnerFeedbackOnboardingCapability | null;
} = {}): Promise<SourceOwnerFeedback[]> {
  const uniqueSourceMomentIds = [
    ...new Set(
      sourceMomentIds.filter((id) => UUID_PATTERN.test(id)),
    ),
  ].slice(0, MAX_SOURCE_MOMENT_IDS);

  if (uniqueSourceMomentIds.length === 0 && !onboarding) {
    return [];
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const supabase = createBrowserSupabaseClient();
    const { data } = supabase
      ? await supabase.auth.getSession()
      : { data: { session: null } };
    const accessToken = data.session?.access_token;

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch("/api/cat-moment-feedback", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers,
      body: JSON.stringify({
        sourceMomentIds: uniqueSourceMomentIds,
        ...(onboarding ? { onboarding } : {}),
      }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      feedback?: unknown;
      ok?: unknown;
    };
    if (payload.ok !== true || !Array.isArray(payload.feedback)) {
      return [];
    }

    return payload.feedback
      .filter(isSourceOwnerFeedback)
      .slice(0, MAX_SOURCE_MOMENT_IDS);
  } catch {
    return [];
  }
}

function isSourceOwnerFeedback(value: unknown): value is SourceOwnerFeedback {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const item = value as Partial<SourceOwnerFeedback>;
  return (
    typeof item.sourceMomentId === "string" &&
    UUID_PATTERN.test(item.sourceMomentId) &&
    typeof item.localPhotoId === "string" &&
    item.localPhotoId.length > 0 &&
    item.localPhotoId.length <= 240 &&
    (item.state === "delivered" || item.state === "selected")
  );
}
