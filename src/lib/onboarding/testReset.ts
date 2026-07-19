import {
  STORAGE_KEYS,
  invalidateCachedJson,
  removeCachedJson,
  writeCachedJson,
} from "../storage";
import {
  AUTH_CODE_VERIFIER_STORAGE_KEY,
  AUTH_STORAGE_KEY,
} from "../authDebug";
import { clearDurableOnboardingProgress } from "./progress";
import { clearPhotoHistoryLedger } from "../photoHistoryLedger";
import { clearCollectionPhotoLedger } from "../collection/photoHistoryLedger";
import { markInternalAnalyticsSession } from "../analytics/traffic";
import { clearOnboardingJourney } from "./journey";

const RESET_QUERY_KEY = "reset_onboarding";
const LEGACY_RESET_QUERY_KEY = "reset";
const REFERRAL_QUERY_KEYS = ["ref", "referral", "invite"] as const;
export const ONBOARDING_TEST_RESET_MARKER_KEY =
  "neteruneko_onboarding_test_reset_done";

const ONBOARDING_TEST_RESET_KEYS = [
  STORAGE_KEYS.accountCreatePromptDismissed,
  STORAGE_KEYS.accountRestorePromptDismissed,
  STORAGE_KEYS.activeCatId,
  STORAGE_KEYS.analyticsAnonymousId,
  STORAGE_KEYS.authGooglePending,
  AUTH_CODE_VERIFIER_STORAGE_KEY,
  AUTH_STORAGE_KEY,
  STORAGE_KEYS.catGalleryPhotos,
  STORAGE_KEYS.catProfiles,
  STORAGE_KEYS.collectionPhotos,
  STORAGE_KEYS.currentCatHintSuppression,
  STORAGE_KEYS.eveningDeliveryDays,
  STORAGE_KEYS.legacyCatProfile,
  STORAGE_KEYS.omoideMemories,
  STORAGE_KEYS.omoideMemoryControls,
  STORAGE_KEYS.onboardingCompleted,
  STORAGE_KEYS.onboardingJourney,
  STORAGE_KEYS.onboardingProgress,
  STORAGE_KEYS.pendingReferralCode,
  "neteruneko_cat_gallery_intro_acknowledged",
  "neteruneko_cat_gallery_restore_checked",
  "neteruneko_cat_sleeping_milestones",
  "neteruneko_cat_sleeping_stats",
  "neteruneko_home_today_cat_selection",
  "neteruneko_mainichi_seen_photo_keys",
  "neteruneko_onboarding_album_completion_ready",
  "neteruneko_onboarding_photo_debug",
  "neteruneko_exchange_photo_offline_cache",
  "neteruneko_open_sound_candidate",
  "neteruneko_open_sound_enabled",
  "nyaruhodo_exchange_dismissed_photos",
  "nyaruhodo_exchange_kept_photos",
  "nyaruhodo_exchange_own_sleeping_photos",
  "nyaruhodo_exchange_reported_photos",
] as const;

const ONBOARDING_TEST_RESET_PREFIXES = [
  "active_cat_id_mikke_window_answers_",
  "discovery_log_",
  "light_data_",
  "lock_data_",
  "record_log_",
] as const;

const ONBOARDING_TEST_RESET_SESSION_KEYS = [
  "neteruneko_onboarding_album_completion_ready",
] as const;

export async function consumeOnboardingTestResetRequest() {
  if (typeof window === "undefined") {
    return false;
  }

  const url = new URL(window.location.href);
  const resetValue =
    url.searchParams.get(RESET_QUERY_KEY) ??
    url.searchParams.get(LEGACY_RESET_QUERY_KEY);

  if (resetValue !== "1" && resetValue !== "true") {
    return false;
  }

  const referralCode = readReferralCodeFromResetUrl(url);

  await clearOnboardingTestLocalState();

  if (referralCode) {
    writeCachedJson(STORAGE_KEYS.pendingReferralCode, {
      code: referralCode,
      capturedAt: new Date().toISOString(),
      path: url.pathname,
    });
  } else {
    removeCachedJson(STORAGE_KEYS.pendingReferralCode);
  }

  markOnboardingTestReset();
  removeResetQuery(url);

  return true;
}

export function hasOnboardingTestResetMarker() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.sessionStorage.getItem(ONBOARDING_TEST_RESET_MARKER_KEY) === "true"
    );
  } catch {
    return false;
  }
}

export async function clearOnboardingTestTargetState() {
  if (typeof window === "undefined") {
    return;
  }

  await clearOnboardingTestLocalState();
  markOnboardingTestReset();
}

async function clearOnboardingTestLocalState() {
  clearOnboardingJourney();
  await Promise.all([
    clearDurableOnboardingProgress().catch(() => undefined),
    clearPhotoHistoryLedger().catch(() => undefined),
    clearCollectionPhotoLedger().catch(() => undefined),
  ]);

  for (const key of ONBOARDING_TEST_RESET_KEYS) {
    removeCachedJson(key);
  }

  removeLocalStorageKeysByPrefix(ONBOARDING_TEST_RESET_PREFIXES);

  try {
    for (const key of ONBOARDING_TEST_RESET_SESSION_KEYS) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Some embedded browsers expose storage but reject access to it.
  }

  invalidateCachedJson();
}

function markOnboardingTestReset() {
  markInternalAnalyticsSession();

  try {
    window.sessionStorage.setItem(ONBOARDING_TEST_RESET_MARKER_KEY, "true");
  } catch {
    // The local reset still applies when sessionStorage is unavailable.
  }
}

function readReferralCodeFromResetUrl(url: URL) {
  for (const key of REFERRAL_QUERY_KEYS) {
    const code = url.searchParams
      .get(key)
      ?.trim()
      .toUpperCase()
      .replace(/[^23456789A-Z]/g, "");

    if (code && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/.test(code)) {
      return code;
    }
  }

  return null;
}

function removeLocalStorageKeysByPrefix(prefixes: readonly string[]) {
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}

function removeResetQuery(url: URL) {
  url.searchParams.delete(RESET_QUERY_KEY);
  url.searchParams.delete(LEGACY_RESET_QUERY_KEY);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;

  window.history.replaceState(window.history.state, "", nextUrl);
}
