import type { OnboardingProgress } from "./progress";

export type OnboardingResumeDecision =
  | { kind: "intro" }
  | { kind: "home" }
  | { kind: "preview"; progress: OnboardingProgress }
  | { kind: "photo_prompt"; progress: OnboardingProgress }
  | { kind: "envelope"; progress: OnboardingProgress }
  | { kind: "naming"; progress: OnboardingProgress }
  | { kind: "resume_submission"; progress: OnboardingProgress };

export function resolveOnboardingResumeDecision(
  progress: OnboardingProgress | null,
): OnboardingResumeDecision {
  if (!progress) {
    return { kind: "intro" };
  }

  if (
    progress.stage === "album_created" ||
    progress.stage === "skipped"
  ) {
    return { kind: "home" };
  }

  if (progress.stage === "opened") {
    return { kind: "home" };
  }

  if (
    progress.stage === "photo_pending" &&
    progress.deliveryBundleId &&
    progress.pendingDeliveryPhotoId &&
    progress.deliveredPhotos?.some(
      (photo) => photo.id === progress.pendingDeliveryPhotoId,
    )
  ) {
    return { kind: "photo_prompt", progress };
  }

  if (
    progress.stage === "preview_ready" &&
    progress.deliveryBundleId &&
    progress.deliveredPhotos?.length
  ) {
    return { kind: "preview", progress };
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
