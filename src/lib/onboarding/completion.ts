import { readOwnSleepingPhotos } from "../home/sleepingPhotos";
import { STORAGE_KEYS } from "../storage";
import { readOnboardingProgress } from "./progress";

export function hasOnboardingCompletionMarker() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true"
    );
  } catch {
    return false;
  }
}

export function hasCompletedOnboardingEvidence() {
  const progress = readOnboardingProgress();

  if (progress?.stage === "album_created" || progress?.stage === "opened") {
    return true;
  }

  return readOwnSleepingPhotos().length > 0;
}

export function hasCompletedOnboardingState() {
  return hasOnboardingCompletionMarker() && hasCompletedOnboardingEvidence();
}

export function clearOnboardingCompletionMarker() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
  } catch {
    // A stale marker must not block a first onboarding when storage is restricted.
  }
}
