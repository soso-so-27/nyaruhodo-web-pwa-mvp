import { isEmbeddedInAppBrowser } from "./displayEnvironment";

export type HomeInstallPlatform = "ios" | "android";

export const HOME_INSTALL_ONBOARDING_COMPLETED_EVENT =
  "neteruneko_onboarding_completed";
export const HOME_INSTALL_HINT_SNOOZED_UNTIL_STORAGE_KEY =
  "neteruneko_home_install_hint_snoozed_until";
export const HOME_INSTALL_HOME_VISIT_COUNT_STORAGE_KEY =
  "neteruneko_home_install_home_visit_count";

const HOME_INSTALL_HINT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const HOME_INSTALL_MINIMUM_HOME_VISITS = 2;

export function getHomeInstallPlatform(): HomeInstallPlatform | null {
  if (typeof window === "undefined" || isEmbeddedInAppBrowser()) {
    return null;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos =
    /iphone|ipad|ipod/.test(userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1);

  if (isIos) {
    return "ios";
  }

  return /android/.test(userAgent) ? "android" : null;
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
      window.matchMedia?.("(display-mode: fullscreen)").matches ||
      navigatorWithStandalone.standalone,
  );
}

export function isHomeInstallHintSnoozed(now = Date.now()) {
  if (typeof window === "undefined") {
    return true;
  }

  const snoozedUntil = Number(
    window.localStorage.getItem(
      HOME_INSTALL_HINT_SNOOZED_UNTIL_STORAGE_KEY,
    ),
  );

  return Number.isFinite(snoozedUntil) && snoozedUntil > now;
}

export function snoozeHomeInstallHint(now = Date.now()) {
  window.localStorage.setItem(
    HOME_INSTALL_HINT_SNOOZED_UNTIL_STORAGE_KEY,
    String(now + HOME_INSTALL_HINT_SNOOZE_MS),
  );
}

export function recordHomeInstallHomeVisit() {
  if (typeof window === "undefined") {
    return 0;
  }

  const currentCount = readHomeInstallHomeVisitCount();
  const nextCount = Math.min(
    HOME_INSTALL_MINIMUM_HOME_VISITS,
    currentCount + 1,
  );

  try {
    window.localStorage.setItem(
      HOME_INSTALL_HOME_VISIT_COUNT_STORAGE_KEY,
      String(nextCount),
    );
  } catch {
    return currentCount;
  }

  return nextCount;
}

export function isHomeInstallHintReadyForVisit() {
  return readHomeInstallHomeVisitCount() >= HOME_INSTALL_MINIMUM_HOME_VISITS;
}

function readHomeInstallHomeVisitCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const count = Number(
      window.localStorage.getItem(
        HOME_INSTALL_HOME_VISIT_COUNT_STORAGE_KEY,
      ),
    );
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  } catch {
    return 0;
  }
}
