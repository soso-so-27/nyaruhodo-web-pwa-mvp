import { STORAGE_KEYS } from "../storage";
import type { OnboardingSource } from "./progress";
import {
  createOnboardingResumeToken,
  isOnboardingResumeToken,
} from "./submissionContract";
import {
  createOnboardingJourneyId,
  isOnboardingJourney,
  isOnboardingJourneyId,
  type OnboardingJourney,
} from "./journeyContract";

export function getOrCreateOnboardingJourney({
  dateKey,
  source,
  journeyId,
  resumeToken,
}: {
  dateKey: string;
  source: OnboardingSource;
  journeyId?: string | null;
  resumeToken?: string | null;
}) {
  const preferred =
    isOnboardingJourneyId(journeyId) && isOnboardingResumeToken(resumeToken)
      ? {
          version: 1 as const,
          id: journeyId,
          dateKey,
          source,
          resumeToken,
          createdAt: Date.now(),
        }
      : null;
  const current = readOnboardingJourney();
  const matchingCurrent =
    current && current.dateKey === dateKey ? current : null;
  const next = preferred ?? matchingCurrent ?? {
    version: 1 as const,
    id: createOnboardingJourneyId(),
    dateKey,
    source,
    resumeToken: createOnboardingResumeToken(),
    createdAt: Date.now(),
  };
  const normalized =
    next.source === "direct" && source !== "direct"
      ? { ...next, source }
      : next;

  writeOnboardingJourney(normalized);
  return normalized;
}

export function readOnboardingJourney(): OnboardingJourney | null {
  if (typeof window === "undefined") {
    return null;
  }

  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(STORAGE_KEYS.onboardingJourney);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (isOnboardingJourney(parsed)) {
        return parsed;
      }
    } catch {
      // The other storage tier may still be available.
    }
  }

  return null;
}

export function restoreOnboardingJourney(value: unknown) {
  if (!isOnboardingJourney(value)) {
    return false;
  }

  writeOnboardingJourney(value);
  return true;
}

export function clearOnboardingJourney() {
  if (typeof window === "undefined") {
    return;
  }

  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      storage.removeItem(STORAGE_KEYS.onboardingJourney);
    } catch {
      // Test reset remains best-effort when a browser rejects storage access.
    }
  }
}

function writeOnboardingJourney(journey: OnboardingJourney) {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(journey);
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      storage.setItem(STORAGE_KEYS.onboardingJourney, serialized);
    } catch {
      // A single storage failure must not stop onboarding.
    }
  }
}
