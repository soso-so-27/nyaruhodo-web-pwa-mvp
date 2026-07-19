import type { OnboardingSource } from "./progress";
import { isOnboardingResumeToken } from "./submissionContract";

export type OnboardingJourney = {
  version: 1;
  id: string;
  dateKey: string;
  source: OnboardingSource;
  resumeToken: string;
  createdAt: number;
};

const JOURNEY_PREFIX = "onbj_";

export function createOnboardingJourneyId() {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) {
    return `${JOURNEY_PREFIX}${uuid}`;
  }

  return `${JOURNEY_PREFIX}${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}_${Math.random().toString(36).slice(2)}`;
}

export function createOnboardingJourneySubmissionId(
  journeyId: string,
  dateKey: string,
) {
  return `onboarding:${journeyId}:${dateKey}`;
}

export function createOnboardingOwnPhotoId(submissionId: string) {
  const suffix = submissionId
    .replace(/^onboarding:/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-");

  return `onboarding-${suffix}`;
}

export function isOnboardingJourneyId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(JOURNEY_PREFIX) &&
    value.length >= 20 &&
    value.length <= 160 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function isOnboardingJourney(value: unknown): value is OnboardingJourney {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const journey = value as Partial<OnboardingJourney>;
  return (
    journey.version === 1 &&
    isOnboardingJourneyId(journey.id) &&
    typeof journey.dateKey === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(journey.dateKey) &&
    isOnboardingSource(journey.source) &&
    isOnboardingResumeToken(journey.resumeToken) &&
    typeof journey.createdAt === "number" &&
    Number.isFinite(journey.createdAt)
  );
}

function isOnboardingSource(value: unknown): value is OnboardingSource {
  return (
    value === "direct" ||
    value === "instagram" ||
    value === "instagram_story" ||
    value === "instagram_bio" ||
    value === "instagram_dm" ||
    value === "referral" ||
    value === "unknown"
  );
}
