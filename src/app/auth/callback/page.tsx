"use client";

import { useEffect, useRef } from "react";
import { AppLoadingScreen } from "../../../components/loading/AppLoadingScreen";
import { trackProductEvent } from "../../../lib/analytics/productAnalytics";
import {
  finalizeAnonymousStorageTransfer,
  prepareAnonymousStorageRefsForAccountSwitch,
} from "../../../lib/auth/anonymousAccountSwitch";
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
    const supabase = createBrowserSupabaseClient();

    if (!code) {
      if (supabase && shouldFallbackFromLinkIdentity()) {
        await startExistingGoogleFallback({
          supabase,
          next,
          reason: "link_identity_callback_missing_code",
        });
        return;
      }

      trackProductEvent("auth_google_failed", {
        error_type: "missing_callback_code",
      });
      window.location.replace(errorPath);
      return;
    }

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
      if (shouldFallbackFromLinkIdentity()) {
        await startExistingGoogleFallback({
          supabase,
          next,
          reason: "link_identity_code_exchange_failed",
        });
        return;
      }

      window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
      trackProductEvent("auth_google_failed", {
        error_type: "code_exchange_failed",
        error_message: error.message,
      });
      window.location.replace(errorPath);
      return;
    }

    const transfer = await finalizeAnonymousStorageTransfer();
    if (transfer.copied > 0 || transfer.error) {
      trackProductEvent("auth_google_anonymous_storage_transfer_completed", {
        route: "/auth/callback",
        copied_storage_refs: transfer.copied,
        had_error: Boolean(transfer.error),
      });
    }

    const successUrl = new URL(next, window.location.origin);
    successUrl.searchParams.set("auth", "google_success");
    window.location.replace(successUrl.toString());
  }

  return <AppLoadingScreen variant="account" />;
}

async function startExistingGoogleFallback({
  supabase,
  next,
  reason,
}: {
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>;
  next: string;
  reason: string;
}) {
  const prepared = await prepareAnonymousStorageRefsForAccountSwitch();
  trackProductEvent("auth_google_link_fallback_started", {
    route: "/auth/callback",
    reason,
    had_error: Boolean(prepared.error),
    pending_storage_refs: prepared.pendingPaths,
  });
  if (prepared.error && prepared.pendingPaths > 0) {
    trackProductEvent("auth_google_failed", {
      error_type: "anonymous_storage_transfer_intent_failed",
      error_message: prepared.error,
    });
    window.location.replace(getAuthErrorPath(next));
    return;
  }
  window.localStorage.setItem(
    STORAGE_KEYS.authGooglePending,
    JSON.stringify({
      provider: "google",
      route: "/auth/callback",
      method: "oauth_redirect_existing_fallback",
      reason,
      startedAt: new Date().toISOString(),
    }),
  );
  await supabase.auth.signOut({ scope: "local" });
  const redirectTo = createAuthCallbackUrl({ nextPath: next });
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
    trackProductEvent("auth_google_failed", {
      error_type: "link_fallback_start_failed",
      error_message: error.message,
    });
    window.location.replace(getAuthErrorPath(next));
  }
}

function shouldFallbackFromLinkIdentity() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.authGooglePending);
    const pending = raw ? (JSON.parse(raw) as { method?: string }) : null;
    return pending?.method === "link_identity";
  } catch {
    return false;
  }
}

function createAuthCallbackUrl({ nextPath }: { nextPath: string }) {
  const callbackUrl = new URL("/auth/callback", window.location.origin);

  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
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
