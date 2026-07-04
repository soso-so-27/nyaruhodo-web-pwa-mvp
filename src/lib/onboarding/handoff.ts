import {
  readActiveCatId,
  readCatProfiles,
} from "../../components/home/homeInputHelpers";
import {
  readAllOwnSleepingPhotos,
  readKeptExchangePhotos,
  restoreSyncedSleepingPhotos,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../home/sleepingPhotos";
import { STORAGE_KEYS, writeCachedJson } from "../storage";
import {
  markOnboardingAlbumCreated,
  normalizeOnboardingSource,
  readOnboardingProgress,
  writeOnboardingProgress,
  type OnboardingProgress,
  type OnboardingSource,
} from "./progress";

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

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    source,
    onboardingProgress:
      markCompleted && onboardingProgress
        ? { ...onboardingProgress, stage: "album_created", updatedAt: Date.now() }
        : onboardingProgress,
    onboardingCompleted:
      markCompleted ||
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true",
    catProfiles: readCatProfiles(),
    activeCatId: readActiveCatId(),
    ownSleepingPhotos: readAllOwnSleepingPhotos(),
    keptExchangePhotos: readKeptExchangePhotos(),
    pendingReferralCode: window.localStorage.getItem(
      STORAGE_KEYS.pendingReferralCode,
    ),
  };
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

  restoreSyncedSleepingPhotos({
    ownPhotos: payload.ownSleepingPhotos,
    keptPhotos: payload.keptExchangePhotos,
    mergeLocal: true,
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
    keptExchangePhotoCount: payload.keptExchangePhotos.length,
    catCount: payload.catProfiles.length,
  };
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
