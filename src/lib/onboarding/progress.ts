import { STORAGE_KEYS } from "../storage";
import {
  getEveningDeliveryTargetDateKey,
  getJstDateKey,
} from "../home/eveningDelivery";
import type { ExchangePhoto, OwnSleepingPhoto } from "../home/sleepingPhotos";

export type OnboardingSource =
  | "direct"
  | "instagram"
  | "instagram_story"
  | "instagram_bio"
  | "instagram_dm"
  | "unknown";

export type OnboardingProgressStage =
  | "submitted"
  | "arrived"
  | "opened"
  | "album_created";

export type OnboardingProgress = {
  version: 1;
  anonymousId: string;
  dateKey: string;
  stage: OnboardingProgressStage;
  source: OnboardingSource;
  submissionId: string;
  ownPhoto?: OwnSleepingPhoto;
  selectedPhotoSrc?: string;
  deliveredPhoto?: ExchangePhoto;
  isDeliveredPhotoKept?: boolean;
  completionCopy?: string;
  updatedAt: number;
};

const ALLOWED_SOURCES = new Set<OnboardingSource>([
  "direct",
  "instagram",
  "instagram_story",
  "instagram_bio",
  "instagram_dm",
]);

export function normalizeOnboardingSource(value: string | null) {
  if (!value) {
    return "direct" satisfies OnboardingSource;
  }

  const normalized = value.trim().toLowerCase();

  return ALLOWED_SOURCES.has(normalized as OnboardingSource)
    ? (normalized as OnboardingSource)
    : ("unknown" satisfies OnboardingSource);
}

export function readOnboardingProgress() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.onboardingProgress);
    const parsed = raw ? (JSON.parse(raw) as Partial<OnboardingProgress>) : null;

    if (!isValidOnboardingProgress(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function readTodayOnboardingProgress(now = Date.now()) {
  const progress = readOnboardingProgress();

  if (!progress || progress.dateKey !== getJstDateKey(now)) {
    return null;
  }

  return progress;
}

export function readCurrentOnboardingProgress(now = Date.now()) {
  const progress = readOnboardingProgress();

  if (!progress) {
    return null;
  }

  const todayKey = getJstDateKey(now);
  const targetKey = getEveningDeliveryTargetDateKey(now);

  if (progress.dateKey !== todayKey && progress.dateKey !== targetKey) {
    return null;
  }

  return progress;
}

export function writeOnboardingProgress(progress: OnboardingProgress) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEYS.onboardingProgress,
      JSON.stringify({ ...progress, updatedAt: Date.now() }),
    );
  } catch {
    // Onboarding persistence should never block the first experience.
  }
}

export function patchOnboardingProgress(
  patch: Partial<OnboardingProgress> & Pick<OnboardingProgress, "stage">,
) {
  const current = readOnboardingProgress();
  const dateKey = patch.dateKey ?? current?.dateKey ?? getJstDateKey();
  const anonymousId =
    patch.anonymousId ?? current?.anonymousId ?? getOrCreateOnboardingAnonymousId();

  writeOnboardingProgress({
    version: 1,
    anonymousId,
    dateKey,
    source: patch.source ?? current?.source ?? "direct",
    submissionId:
      patch.submissionId ??
      current?.submissionId ??
      createOnboardingSubmissionId(anonymousId, dateKey),
    ownPhoto: patch.ownPhoto ?? current?.ownPhoto,
    selectedPhotoSrc: patch.selectedPhotoSrc ?? current?.selectedPhotoSrc,
    deliveredPhoto: patch.deliveredPhoto ?? current?.deliveredPhoto,
    isDeliveredPhotoKept:
      patch.isDeliveredPhotoKept ?? current?.isDeliveredPhotoKept,
    completionCopy: patch.completionCopy ?? current?.completionCopy,
    stage: patch.stage,
    updatedAt: Date.now(),
  });
}

export function markOnboardingAlbumCreated(source: OnboardingSource) {
  patchOnboardingProgress({
    stage: "album_created",
    source,
  });
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
}

export function getOrCreateOnboardingAnonymousId() {
  if (typeof window === "undefined") {
    return "anonymous-unavailable";
  }

  const existing = window.localStorage.getItem(STORAGE_KEYS.analyticsAnonymousId);
  if (existing) {
    return existing;
  }

  const nextId =
    globalThis.crypto?.randomUUID?.() ??
    `anonymous-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(STORAGE_KEYS.analyticsAnonymousId, nextId);
  return nextId;
}

export function createOnboardingSubmissionId(
  anonymousId: string,
  dateKey = getJstDateKey(),
) {
  return `onboarding:${anonymousId}:${dateKey}`;
}

function isValidOnboardingProgress(
  value: Partial<OnboardingProgress> | null,
): value is OnboardingProgress {
  return (
    value?.version === 1 &&
    typeof value.anonymousId === "string" &&
    value.anonymousId.length > 0 &&
    typeof value.dateKey === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.dateKey) &&
    typeof value.submissionId === "string" &&
    value.submissionId.length > 0 &&
    isOnboardingProgressStage(value.stage) &&
    isOnboardingSource(value.source) &&
    typeof value.updatedAt === "number"
  );
}

function isOnboardingProgressStage(
  value: unknown,
): value is OnboardingProgressStage {
  return (
    value === "submitted" ||
    value === "arrived" ||
    value === "opened" ||
    value === "album_created"
  );
}

function isOnboardingSource(value: unknown): value is OnboardingSource {
  return (
    value === "direct" ||
    value === "instagram" ||
    value === "instagram_story" ||
    value === "instagram_bio" ||
    value === "instagram_dm" ||
    value === "unknown"
  );
}
