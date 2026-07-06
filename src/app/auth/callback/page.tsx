"use client";

import { useEffect, useRef } from "react";
import { AppLoadingScreen } from "../../../components/loading/AppLoadingScreen";
import { trackProductEvent } from "../../../lib/analytics/productAnalytics";
import { purgeAllPhotoSwCache } from "../../../lib/photoSwCache";
import { STORAGE_KEYS } from "../../../lib/storage";
import { createBrowserSupabaseClient } from "../../../lib/supabase/browser";

export default function AuthCallbackPage() {
  const hasHandledCallback = useRef(false);

  useEffect(() => {
    if (hasHandledCallback.current) {
      return;
    }

    hasHandledCallback.current = true;
    void handleAuthCallback();
  }, []);

  async function handleAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const next = getSafeNextPath(params.get("next"));
    const errorPath = getAuthErrorPath(next);

    if (!code) {
      trackProductEvent("auth_google_failed", {
        error_type: "missing_callback_code",
      });
      window.location.replace(errorPath);
      return;
    }

    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      trackProductEvent("auth_google_failed", {
        error_type: "missing_supabase_client",
      });
      window.location.replace(errorPath);
      return;
    }

    purgeAllPhotoSwCache("account_switch");
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
      trackProductEvent("auth_google_failed", {
        error_type: "code_exchange_failed",
        error_message: error.message,
      });
      window.location.replace(errorPath);
      return;
    }

    const successUrl = new URL(next, window.location.origin);
    successUrl.searchParams.set("auth", "google_success");
    window.location.replace(successUrl.toString());
  }

  return <AppLoadingScreen variant="account" />;
}

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/home";
  }

  return next;
}

function getAuthErrorPath(next: string) {
  if (next.startsWith("/account/create")) {
    const url = new URL(next, window.location.origin);

    url.searchParams.set("error", "auth");
    return `${url.pathname}${url.search}`;
  }

  return "/account/create?error=auth";
}
