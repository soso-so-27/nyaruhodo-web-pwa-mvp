import { STORAGE_KEYS } from "../storage";
import { getOrCreateAnonymousId } from "../identity/anonymousId";
import {
  addJstDays,
  getEveningDeliveryTargetDateKey,
  getJstDateKey,
  getJstHour,
} from "../home/eveningDelivery";
import {
  sanitizeExchangePhotoForPersistence,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../home/sleepingPhotos";
import {
  readDurableClientValue,
  removeDurableClientValue,
  writeDurableClientValue,
} from "../storage/durableClientStore";

export type OnboardingSource =
  | "direct"
  | "instagram"
  | "instagram_story"
  | "instagram_bio"
  | "instagram_dm"
  | "referral"
  | "unknown";

export type OnboardingProgressStage =
  | "name_pending"
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
  "referral",
]);

const ONBOARDING_SOURCE_QUERY_KEYS = ["src", "source", "utm_source"] as const;
const DURABLE_ONBOARDING_PROGRESS_KEY = "onboarding-progress:v1";
let durableProgressCache: OnboardingProgress | null = null;
let durableProgressWriteQueue = Promise.resolve();

export function normalizeOnboardingSource(value: string | null) {
  if (!value) {
    return "direct" satisfies OnboardingSource;
  }

  const normalized = value.trim().toLowerCase();

  return ALLOWED_SOURCES.has(normalized as OnboardingSource)
    ? (normalized as OnboardingSource)
    : ("unknown" satisfies OnboardingSource);
}

export function readOnboardingSourceFromLocation() {
  if (typeof window === "undefined") {
    return "direct" satisfies OnboardingSource;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has("ref") || params.has("referral") || params.has("invite")) {
    writeOnboardingSourceToSession("referral");
    return "referral" satisfies OnboardingSource;
  }

  for (const key of ONBOARDING_SOURCE_QUERY_KEYS) {
    const raw = params.get(key);
    if (raw) {
      const source = normalizeOnboardingSource(raw);
      writeOnboardingSourceToSession(source);
      return source;
    }
  }

  const stored = readOnboardingSourceFromSession();
  return stored ?? ("direct" satisfies OnboardingSource);
}

export function readOnboardingSourceFromSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEYS.onboardingSource);
    return isOnboardingSource(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeOnboardingSourceToSession(source: OnboardingSource) {
  try {
    window.sessionStorage.setItem(STORAGE_KEYS.onboardingSource, source);
  } catch {
    // Attribution should never block onboarding.
  }
}

export function readOnboardingProgress() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.onboardingProgress);
    const parsed = raw ? (JSON.parse(raw) as Partial<OnboardingProgress>) : null;

    const localProgress = isValidOnboardingProgress(parsed) ? parsed : null;
    return getNewestOnboardingProgress(localProgress, durableProgressCache);
  } catch {
    return durableProgressCache;
  }
}

export async function readOnboardingProgressDurably() {
  await durableProgressWriteQueue.catch(() => undefined);
  const durableProgress = await readDurableClientValue<OnboardingProgress>(
    DURABLE_ONBOARDING_PROGRESS_KEY,
  ).catch(() => null);
  durableProgressCache = isValidOnboardingProgress(durableProgress)
    ? durableProgress
    : null;

  return readOnboardingProgress();
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
  const previousNightKey =
    getJstHour(now) < 5 ? addJstDays(todayKey, -1) : null;

  if (
    progress.dateKey !== todayKey &&
    progress.dateKey !== targetKey &&
    progress.dateKey !== previousNightKey
  ) {
    return null;
  }

  return progress;
}

export async function readCurrentOnboardingProgressDurably(now = Date.now()) {
  await readOnboardingProgressDurably();
  return readCurrentOnboardingProgress(now);
}

export function writeOnboardingProgress(progress: OnboardingProgress) {
  if (typeof window === "undefined") {
    return false;
  }

  const persistentProgress = prepareOnboardingProgressForPersistence(progress);
  durableProgressCache = persistentProgress;
  void queueDurableOnboardingProgressWrite(persistentProgress).catch(
    () => undefined,
  );

  try {
    window.localStorage.setItem(
      STORAGE_KEYS.onboardingProgress,
      JSON.stringify(persistentProgress),
    );
    return true;
  } catch {
    return false;
  }
}

export async function writeOnboardingProgressDurably(
  progress: OnboardingProgress,
) {
  if (typeof window === "undefined") {
    return false;
  }

  const persistentProgress = prepareOnboardingProgressForPersistence(progress);
  durableProgressCache = persistentProgress;
  const localStorageWritten = writeOnboardingProgressToLocalStorage(
    persistentProgress,
  );

  try {
    await queueDurableOnboardingProgressWrite(persistentProgress);
  } catch (error) {
    if (!localStorageWritten) {
      throw error;
    }
  }

  return true;
}

export async function clearDurableOnboardingProgress() {
  durableProgressCache = null;
  const clearOperation = durableProgressWriteQueue
    .catch(() => undefined)
    .then(() => removeDurableClientValue(DURABLE_ONBOARDING_PROGRESS_KEY));
  durableProgressWriteQueue = clearOperation;
  await clearOperation;

  if (durableProgressWriteQueue === clearOperation) {
    durableProgressCache = null;
    durableProgressWriteQueue = Promise.resolve();
  }
}

export function patchOnboardingProgress(
  patch: Partial<OnboardingProgress> & Pick<OnboardingProgress, "stage">,
) {
  writeOnboardingProgress(buildPatchedOnboardingProgress(patch));
}

export function patchOnboardingProgressDurably(
  patch: Partial<OnboardingProgress> & Pick<OnboardingProgress, "stage">,
) {
  return writeOnboardingProgressDurably(buildPatchedOnboardingProgress(patch));
}

function buildPatchedOnboardingProgress(
  patch: Partial<OnboardingProgress> & Pick<OnboardingProgress, "stage">,
) {
  const current = readOnboardingProgress();
  const dateKey = patch.dateKey ?? current?.dateKey ?? getJstDateKey();
  const anonymousId =
    patch.anonymousId ?? current?.anonymousId ?? getOrCreateOnboardingAnonymousId();
  const deliveredPhoto = sanitizeOptionalDeliveredPhoto(
    patch.deliveredPhoto ?? current?.deliveredPhoto,
  );

  return {
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
    ...(deliveredPhoto ? { deliveredPhoto } : {}),
    isDeliveredPhotoKept:
      patch.isDeliveredPhotoKept ?? current?.isDeliveredPhotoKept,
    completionCopy: patch.completionCopy ?? current?.completionCopy,
    stage: patch.stage,
    updatedAt: Date.now(),
  } satisfies OnboardingProgress;
}

function sanitizeOptionalDeliveredPhoto(photo: ExchangePhoto | undefined) {
  return sanitizeExchangePhotoForPersistence(photo) ?? undefined;
}

function prepareOnboardingProgressForPersistence(
  progress: OnboardingProgress,
): OnboardingProgress {
  const deliveredPhoto = sanitizeOptionalDeliveredPhoto(progress.deliveredPhoto);

  return {
    ...progress,
    ...(deliveredPhoto ? { deliveredPhoto } : { deliveredPhoto: undefined }),
    updatedAt: Date.now(),
  };
}

function queueDurableOnboardingProgressWrite(progress: OnboardingProgress) {
  const nextWrite = durableProgressWriteQueue
    .catch(() => undefined)
    .then(() =>
      writeDurableClientValue(DURABLE_ONBOARDING_PROGRESS_KEY, progress),
    );
  durableProgressWriteQueue = nextWrite;
  return nextWrite;
}

function writeOnboardingProgressToLocalStorage(progress: OnboardingProgress) {
  if (durableProgressCache !== progress) {
    return false;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEYS.onboardingProgress,
      JSON.stringify(progress),
    );
    return true;
  } catch {
    return false;
  }
}

function getNewestOnboardingProgress(
  first: OnboardingProgress | null,
  second: OnboardingProgress | null,
) {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return first.updatedAt >= second.updatedAt ? first : second;
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

  return getOrCreateAnonymousId();
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
    value === "name_pending" ||
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
    value === "referral" ||
    value === "unknown"
  );
}
