export type AnalyticsTrafficKind = "product" | "internal";

const INTERNAL_ANALYTICS_SESSION_KEY =
  "neteruneko_internal_analytics_session";

export function markInternalAnalyticsSession() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(INTERNAL_ANALYTICS_SESSION_KEY, "true");
  } catch {
    // Analytics classification must never block the product experience.
  }
}

export function readAnalyticsTrafficKind(): AnalyticsTrafficKind {
  if (typeof window === "undefined") {
    return "product";
  }

  if (
    window.location.pathname.startsWith("/admin") ||
    isLocalDevelopmentHost(window.location.hostname) ||
    hasExplicitTestResetQuery(window.location.search)
  ) {
    markInternalAnalyticsSession();
    return "internal";
  }

  try {
    return window.sessionStorage.getItem(INTERNAL_ANALYTICS_SESSION_KEY) ===
      "true"
      ? "internal"
      : "product";
  } catch {
    return "product";
  }
}

function hasExplicitTestResetQuery(search: string) {
  const params = new URLSearchParams(search);
  return [params.get("reset_onboarding"), params.get("reset")].some(
    (value) => value === "1" || value === "true",
  );
}

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
