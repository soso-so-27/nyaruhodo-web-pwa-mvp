import {
  readActiveCatId,
  readCatProfiles,
  type CatProfile,
} from "../../components/home/homeInputHelpers";
import {
  readAllOwnSleepingPhotos,
  restoreSyncedSleepingPhotos,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../home/sleepingPhotos";
import { STORAGE_KEYS, removeCachedJson, writeCachedJson } from "../storage";
import {
  markOnboardingAlbumCreated,
  normalizeOnboardingSource,
  readOnboardingProgress,
  writeOnboardingProgress,
  type OnboardingProgress,
  type OnboardingSource,
} from "./progress";

const ONBOARDING_HANDOFF_OWN_PHOTOS_KEY = "nyaruhodo_exchange_own_sleeping_photos";
const ONBOARDING_HANDOFF_KEPT_PHOTOS_KEY = "nyaruhodo_exchange_kept_photos";

export type OnboardingHandoffPayload = {
  version: 1;
  createdAt: string;
  source: OnboardingSource;
  onboardingProgress: OnboardingProgress | null;
  onboardingCompleted: boolean;
  catProfiles: unknown[];
  activeCatId: string | null;
  ownSleepingPhotos: OwnSleepingPhoto[];
  keptExchangePhotos: ExchangePhoto[];
  pendingReferralCode: string | null;
};

export type CreateOnboardingHandoffResult = {
  token: string;
  expiresAt: string;
  continueUrl: string;
};

export async function createOnboardingHandoff({
  source,
  markCompleted = false,
}: {
  source: OnboardingSource;
  markCompleted?: boolean;
}): Promise<CreateOnboardingHandoffResult> {
  const payload = createOnboardingHandoffPayload(source, markCompleted);
  const response = await fetch("/api/onboarding/handoff/create", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      source,
      payload,
    }),
  });

  const result = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        token?: string;
        expiresAt?: string;
        continueUrl?: string;
        error?: string;
      }
    | null;

  if (!response.ok || !result?.ok || !result.token || !result.continueUrl) {
    throw new Error(result?.error ?? "handoff_create_failed");
  }

  if (markCompleted) {
    markOnboardingAlbumCreated(source);
  }

  return {
    token: result.token,
    expiresAt: result.expiresAt ?? "",
    continueUrl: result.continueUrl,
  };
}

export async function redeemOnboardingHandoff(token: string) {
  const response = await fetch("/api/onboarding/handoff/redeem", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  const result = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        payload?: unknown;
        error?: string;
      }
    | null;

  if (!response.ok || !result?.ok) {
    throw new Error(result?.error ?? "handoff_redeem_failed");
  }

  return restoreOnboardingHandoffPayload(result.payload);
}

export function createOnboardingHandoffPayload(
  source: OnboardingSource,
  markCompleted = false,
): OnboardingHandoffPayload {
  const onboardingProgress = readOnboardingProgress();
  const nextOnboardingProgress =
    markCompleted && onboardingProgress
      ? {
          ...onboardingProgress,
          stage: "album_created" as const,
          updatedAt: Date.now(),
        }
      : onboardingProgress;
  const currentCatId = getCurrentOnboardingCatId(nextOnboardingProgress);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    source,
    onboardingProgress: nextOnboardingProgress,
    onboardingCompleted:
      markCompleted ||
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true",
    catProfiles: getCurrentOnboardingCatProfiles(currentCatId),
    activeCatId: currentCatId,
    ownSleepingPhotos: getCurrentOnboardingOwnPhotos(nextOnboardingProgress),
    keptExchangePhotos: [],
    pendingReferralCode: getCurrentPendingReferralCode(
      nextOnboardingProgress,
      source,
    ),
  };
}

function getCurrentOnboardingCatId(
  progress: OnboardingProgress | null,
): string | null {
  return (
    progress?.ownPhoto?.ownerCatId ??
    progress?.ownPhoto?.catId ??
    readActiveCatId()
  );
}

function getCurrentOnboardingCatProfiles(catId: string | null): CatProfile[] {
  if (!catId) {
    return [];
  }

  return readCatProfiles().filter((profile) => profile.id === catId);
}

function getCurrentOnboardingOwnPhotos(
  progress: OnboardingProgress | null,
): OwnSleepingPhoto[] {
  if (!progress?.ownPhoto) {
    return [];
  }

  const storedPhoto = readAllOwnSleepingPhotos().find(
    (photo) => photo.id === progress.ownPhoto?.id,
  );

  return [storedPhoto ?? progress.ownPhoto];
}

function getCurrentPendingReferralCode(
  progress: OnboardingProgress | null,
  source: OnboardingSource,
) {
  if (source !== "referral" && progress?.source !== "referral") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEYS.pendingReferralCode);
}

export function restoreOnboardingHandoffPayload(payload: unknown) {
  if (!isOnboardingHandoffPayload(payload)) {
    throw new Error("invalid_handoff_payload");
  }

  if (payload.catProfiles.length > 0) {
    writeCachedJson(STORAGE_KEYS.catProfiles, payload.catProfiles);
  }

  if (payload.activeCatId) {
    window.localStorage.setItem(STORAGE_KEYS.activeCatId, payload.activeCatId);
  }

  if (payload.onboardingProgress) {
    writeOnboardingProgress(payload.onboardingProgress);
  }

  const keptPhotos = getRestoredKeptExchangePhotos(payload);

  removeCachedJson(ONBOARDING_HANDOFF_OWN_PHOTOS_KEY);
  removeCachedJson(ONBOARDING_HANDOFF_KEPT_PHOTOS_KEY);
  restoreSyncedSleepingPhotos({
    ownPhotos: payload.ownSleepingPhotos,
    keptPhotos,
    mergeLocal: false,
  });

  if (payload.pendingReferralCode) {
    window.localStorage.setItem(
      STORAGE_KEYS.pendingReferralCode,
      payload.pendingReferralCode,
    );
  }

  if (payload.onboardingCompleted || payload.onboardingProgress) {
    window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
  }

  return {
    ownSleepingPhotoCount: payload.ownSleepingPhotos.length,
    keptExchangePhotoCount: keptPhotos.length,
    catCount: payload.catProfiles.length,
  };
}

function getRestoredKeptExchangePhotos(
  payload: OnboardingHandoffPayload,
): ExchangePhoto[] {
  const photos = [...payload.keptExchangePhotos];
  const deliveredPhoto = payload.onboardingProgress?.deliveredPhoto;

  if (payload.onboardingProgress?.isDeliveredPhotoKept && deliveredPhoto) {
    photos.push(deliveredPhoto);
  }

  const seen = new Set<string>();
  const restored: ExchangePhoto[] = [];

  for (const photo of photos) {
    const keys = getExchangePhotoDedupeKeys(photo);
    if (keys.some((key) => seen.has(key))) {
      continue;
    }

    for (const key of keys) {
      seen.add(key);
    }
    restored.push(photo);
  }

  return restored;
}

function getExchangePhotoDedupeKeys(photo: ExchangePhoto) {
  return [
    `id:${photo.id}`,
    photo.sourcePhotoId ? `source:${photo.sourcePhotoId}` : "",
    photo.src ? `src:${photo.src}` : "",
    photo.displaySrc ? `display:${photo.displaySrc}` : "",
    photo.originalSrc ? `original:${photo.originalSrc}` : "",
  ].filter(Boolean);
}

function isOnboardingHandoffPayload(
  value: unknown,
): value is OnboardingHandoffPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<OnboardingHandoffPayload>;

  return (
    payload.version === 1 &&
    typeof payload.createdAt === "string" &&
    normalizeOnboardingSource(String(payload.source ?? "")) === payload.source &&
    Array.isArray(payload.catProfiles) &&
    (typeof payload.activeCatId === "string" || payload.activeCatId === null) &&
    Array.isArray(payload.ownSleepingPhotos) &&
    Array.isArray(payload.keptExchangePhotos) &&
    typeof payload.onboardingCompleted === "boolean" &&
    (typeof payload.pendingReferralCode === "string" ||
      payload.pendingReferralCode === null)
  );
}
