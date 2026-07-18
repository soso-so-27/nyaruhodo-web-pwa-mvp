export const ONBOARDING_SERVER_STAGES = [
  "selected",
  "uploading",
  "submitted",
  "delivered",
  "opened",
  "completed",
] as const;

export type OnboardingServerStage = (typeof ONBOARDING_SERVER_STAGES)[number];

export type OnboardingSubmissionAdvanceInput = {
  anonymousId: string | null;
  dateKey: string;
  deliveryId?: string | null;
  ownPhotoId?: string | null;
  resumeToken: string;
  source: string;
  sourcePhotoId?: string | null;
  stage: OnboardingServerStage;
  submissionId: string;
};

export type OnboardingSubmissionStatus = {
  completedAt: string | null;
  createdAt: string;
  dateKey: string;
  deliveryId: string | null;
  ownPhotoId: string | null;
  source: string;
  sourcePhotoId: string | null;
  stage: OnboardingServerStage;
  stageUpdatedAt: string;
  submissionId: string;
  updatedAt: string;
};

const RESUME_TOKEN_PREFIX = "onbr_";

export function createOnboardingResumeToken() {
  const uuid = globalThis.crypto?.randomUUID?.();
  const random = new Uint8Array(18);
  globalThis.crypto?.getRandomValues?.(random);
  const suffix = Array.from(random, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");

  if (uuid && suffix.length === 36) {
    return `${RESUME_TOKEN_PREFIX}${uuid}_${suffix}`;
  }

  return `${RESUME_TOKEN_PREFIX}${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}_${Math.random().toString(36).slice(2)}`;
}

export function isOnboardingResumeToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(RESUME_TOKEN_PREFIX) &&
    value.length >= 32 &&
    value.length <= 160 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function isOnboardingServerStage(
  value: unknown,
): value is OnboardingServerStage {
  return ONBOARDING_SERVER_STAGES.includes(value as OnboardingServerStage);
}

export function getOnboardingServerStageRank(stage: OnboardingServerStage) {
  return ONBOARDING_SERVER_STAGES.indexOf(stage);
}
