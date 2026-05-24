"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { STORAGE_KEYS } from "../../lib/storage";

export function AppAnalyticsTracker() {
  const pathname = usePathname();
  const hasTrackedAppOpen = useRef(false);
  const hasTrackedDisplayMode = useRef(false);

  useEffect(() => {
    if (hasTrackedAppOpen.current) {
      return;
    }

    hasTrackedAppOpen.current = true;
    const appState = getAppState();
    trackProductEvent("app_opened", {
      display_mode: appState.displayMode,
      route: window.location.pathname,
      has_completed_onboarding: appState.hasCompletedOnboarding,
      cat_count: appState.catCount,
    });
  }, []);

  useEffect(() => {
    if (hasTrackedDisplayMode.current) {
      return;
    }

    hasTrackedDisplayMode.current = true;
    trackProductEvent("pwa_display_mode_detected", {
      display_mode: getDisplayMode(),
    });
  }, []);

  useEffect(() => {
    const appState = getAppState();
    trackProductEvent("route_viewed", {
      route: pathname,
      active_tab: getActiveTab(pathname),
      cat_count: appState.catCount,
      has_completed_onboarding: appState.hasCompletedOnboarding,
    });
  }, [pathname]);

  return null;
}

function getAppState() {
  return {
    catCount: getCatCount(),
    displayMode: getDisplayMode(),
    hasCompletedOnboarding:
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true",
  };
}

function getCatCount() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.catProfiles);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function getDisplayMode(): "browser" | "standalone" | "unknown" {
  try {
    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };

    if (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone
    ) {
      return "standalone";
    }

    return "browser";
  } catch {
    return "unknown";
  }
}

function getActiveTab(pathname: string) {
  if (pathname.startsWith("/home") || pathname === "/") {
    return "home";
  }
  if (pathname.startsWith("/torisetu")) {
    return "torisetu";
  }
  if (pathname.startsWith("/collection")) {
    return "collection";
  }
  if (pathname.startsWith("/cats")) {
    return "cats";
  }
  if (pathname.startsWith("/account")) {
    return "account";
  }
  if (pathname.startsWith("/diagnosis-onboarding")) {
    return "diagnosis_onboarding";
  }
  return "other";
}
