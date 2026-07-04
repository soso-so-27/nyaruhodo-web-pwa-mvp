"use client";

import { trackProductEvent } from "../analytics/productAnalytics";
import { readOwnSleepingPhotos } from "../home/sleepingPhotos";
import { readOnboardingProgress } from "../onboarding/progress";
import { STORAGE_KEYS } from "../storage";
import { createBrowserSupabaseClient } from "../supabase/browser";

const REFERRAL_QUERY_KEYS = ["ref", "referral", "invite"] as const;

export type ClientReferralSummary = {
  isLoggedIn: boolean;
  referralEnabled: boolean;
  code: string | null;
  shareUrl: string | null;
  acceptedCount: number;
};

export function capturePendingReferralFromLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const code = REFERRAL_QUERY_KEYS.map((key) => params.get(key))
    .map(normalizeReferralCode)
    .find(Boolean);

  if (!code) {
    return null;
  }

  if (window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true") {
    if (hasCompletedOnboardingEvidence()) {
      window.localStorage.removeItem(STORAGE_KEYS.pendingReferralCode);
      trackProductEvent("referral_link_ignored", {
        code,
        reason: "onboarding_completed",
      });
      return null;
    }

    window.localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
    trackProductEvent("referral_stale_completion_cleared", {
      code,
      reason: "missing_completion_evidence",
    });
  }

  window.localStorage.setItem(
    STORAGE_KEYS.pendingReferralCode,
    JSON.stringify({
      code,
      capturedAt: new Date().toISOString(),
      path: window.location.pathname,
    }),
  );
  trackProductEvent("referral_link_opened", {
    code,
  });

  return code;
}

function hasCompletedOnboardingEvidence() {
  const progress = readOnboardingProgress();

  if (progress?.stage === "album_created" || progress?.stage === "opened") {
    return true;
  }

  return readOwnSleepingPhotos().length > 0;
}

export async function readClientReferralSummary(): Promise<ClientReferralSummary> {
  const headers = await buildAuthHeaders();

  try {
    const response = await fetch("/api/referrals/me", { headers });

    if (!response.ok) {
      return getDefaultReferralSummary();
    }

    return {
      ...getDefaultReferralSummary(),
      ...((await response.json()) as Partial<ClientReferralSummary>),
    };
  } catch {
    return getDefaultReferralSummary();
  }
}

export async function claimPendingReferral() {
  if (typeof window === "undefined") {
    return { claimed: false, status: "not_available" as const };
  }

  const code = readPendingReferralCode();

  if (!code) {
    return { claimed: false, status: "missing_code" as const };
  }

  const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch("/api/referrals/claim", {
    method: "POST",
    headers,
    body: JSON.stringify({
      code,
      anonymousId: window.localStorage.getItem(STORAGE_KEYS.analyticsAnonymousId),
    }),
  });

  if (response.status === 401) {
    return { claimed: false, status: "login_required" as const };
  }

  let payload: {
    claimed?: boolean;
    status?: string;
  } = {};

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    payload = {};
  }

  if (response.ok) {
    window.localStorage.removeItem(STORAGE_KEYS.pendingReferralCode);
    trackProductEvent("referral_claim_completed", {
      code,
      status: payload.status ?? "unknown",
      claimed: Boolean(payload.claimed),
    });
  }

  return {
    claimed: Boolean(payload.claimed),
    status: payload.status ?? (response.ok ? "ok" : "failed"),
  };
}

function readPendingReferralCode() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.pendingReferralCode);
    const parsed = raw ? (JSON.parse(raw) as { code?: unknown }) : null;
    return normalizeReferralCode(parsed?.code);
  } catch {
    return null;
  }
}

async function buildAuthHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  const supabase = createBrowserSupabaseClient();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  return headers;
}

function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const code = value.trim().toUpperCase().replace(/[^23456789A-Z]/g, "");

  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/.test(code)) {
    return null;
  }

  return code;
}

function getDefaultReferralSummary(): ClientReferralSummary {
  return {
    isLoggedIn: false,
    referralEnabled: true,
    code: null,
    shareUrl: null,
    acceptedCount: 0,
  };
}
