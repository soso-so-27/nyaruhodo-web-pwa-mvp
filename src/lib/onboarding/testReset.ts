import { STORAGE_KEYS, invalidateCachedJson, removeCachedJson } from "../storage";

const RESET_QUERY_KEY = "reset_onboarding";
const REFERRAL_QUERY_KEYS = ["ref", "referral", "invite"] as const;

const ONBOARDING_TEST_RESET_KEYS = [
  STORAGE_KEYS.accountCreatePromptDismissed,
  STORAGE_KEYS.accountRestorePromptDismissed,
  STORAGE_KEYS.activeCatId,
  STORAGE_KEYS.authGooglePending,
  STORAGE_KEYS.catGalleryPhotos,
  STORAGE_KEYS.catProfiles,
  STORAGE_KEYS.collectionPhotos,
  STORAGE_KEYS.currentCatHintSuppression,
  STORAGE_KEYS.eveningDeliveryDays,
  STORAGE_KEYS.legacyCatProfile,
  STORAGE_KEYS.omoideMemories,
  STORAGE_KEYS.omoideMemoryControls,
  STORAGE_KEYS.onboardingCompleted,
  STORAGE_KEYS.onboardingProgress,
  "neteruneko_cat_gallery_intro_acknowledged",
  "neteruneko_cat_gallery_restore_checked",
  "neteruneko_cat_sleeping_milestones",
  "neteruneko_cat_sleeping_stats",
  "neteruneko_home_today_cat_selection",
  "neteruneko_mainichi_seen_photo_keys",
  "neteruneko_onboarding_album_completion_ready",
  "neteruneko_onboarding_photo_debug",
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

export function consumeOnboardingTestResetRequest() {
  if (typeof window === "undefined") {
    return false;
  }

  const url = new URL(window.location.href);
  const resetValue = url.searchParams.get(RESET_QUERY_KEY);

  if (resetValue !== "1" && resetValue !== "true") {
    return false;
  }

  const hasReferralQuery = REFERRAL_QUERY_KEYS.some((key) =>
    url.searchParams.has(key),
  );

  for (const key of ONBOARDING_TEST_RESET_KEYS) {
    removeCachedJson(key);
  }

  if (!hasReferralQuery) {
    removeCachedJson(STORAGE_KEYS.pendingReferralCode);
  }

  removeLocalStorageKeysByPrefix(ONBOARDING_TEST_RESET_PREFIXES);

  for (const key of ONBOARDING_TEST_RESET_SESSION_KEYS) {
    window.sessionStorage.removeItem(key);
  }

  window.sessionStorage.setItem("neteruneko_onboarding_test_reset_done", "true");
  invalidateCachedJson();
  removeResetQuery(url);

  return true;
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
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;

  window.history.replaceState(window.history.state, "", nextUrl);
}
