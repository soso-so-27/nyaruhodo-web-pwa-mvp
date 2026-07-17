"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { STORAGE_KEYS, readCachedJson } from "../../lib/storage";

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
      is_in_app_browser: isInAppBrowser(),
      is_standalone_pwa: appState.displayMode === "standalone",
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

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    function handleWindowError(event: ErrorEvent) {
      if (!event.error) {
        return;
      }

      const message = event.message || event.error?.message || "window error";
      if (isInjectedBrowserBridgeError(message)) {
        return;
      }

      trackProductEvent("app_error", {
        surface: "window_error",
        error_code: event.error?.name ?? "window_error",
        error_message: sanitizeAnalyticsErrorMessage(message),
        route: window.location.pathname,
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (event.reason instanceof DOMException && event.reason.name === "AbortError") {
        return;
      }

      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === "string"
            ? event.reason
            : "unhandled rejection";

      trackProductEvent("app_error", {
        surface: "unhandled_rejection",
        error_code:
          event.reason instanceof Error
            ? event.reason.name
            : "unhandled_rejection",
        error_message: sanitizeAnalyticsErrorMessage(reason),
        route: window.location.pathname,
      });
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

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
    const parsed = readCachedJson<unknown>(STORAGE_KEYS.catProfiles) ?? [];
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

function isInjectedBrowserBridgeError(message: string) {
  return message.toLowerCase().includes("window.webkit.messagehandlers");
}

function sanitizeAnalyticsErrorMessage(message: string) {
  return message
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(?:data|blob):\S+/gi, "[url]")
    .slice(0, 240);
}

function isInAppBrowser() {
  const userAgent = window.navigator.userAgent.toLowerCase();

  return (
    userAgent.includes("instagram") ||
    userAgent.includes("fbav") ||
    userAgent.includes("fban") ||
    userAgent.includes("line/") ||
    userAgent.includes("micromessenger")
  );
}

function getActiveTab(pathname: string) {
  if (pathname.startsWith("/home") || pathname === "/") {
    return "home";
  }
  if (pathname.startsWith("/torisetu")) {
    return "cats";
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
    return "cats";
  }
  return "other";
}
