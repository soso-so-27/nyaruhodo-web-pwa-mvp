import type { OnboardingProgress } from "./progress";

export type OnboardingResumeDecision =
  | { kind: "intro" }
  | { kind: "home" }
  | { kind: "second_photo" }
  | { kind: "envelope"; progress: OnboardingProgress }
  | { kind: "naming"; progress: OnboardingProgress }
  | { kind: "resume_submission"; progress: OnboardingProgress };

export function resolveOnboardingResumeDecision(
  progress: OnboardingProgress | null,
): OnboardingResumeDecision {
  if (!progress) {
    return { kind: "intro" };
  }

  if (progress.stage === "album_created") {
    return { kind: "home" };
  }

  if (progress.stage === "opened") {
    return { kind: "second_photo" };
  }

  if (progress.stage === "arrived" && progress.deliveredPhoto) {
    return { kind: "envelope", progress };
  }

  if (
    progress.stage === "name_pending" &&
    progress.ownPhoto &&
    progress.deliveredPhoto
  ) {
    return { kind: "naming", progress };
  }

  if (
    (progress.stage === "submitted" || progress.stage === "name_pending") &&
    progress.ownPhoto
  ) {
    return {
      kind: "resume_submission",
      progress:
        progress.stage === "name_pending"
          ? { ...progress, stage: "submitted" }
          : progress,
    };
  }

  return { kind: "intro" };
}
