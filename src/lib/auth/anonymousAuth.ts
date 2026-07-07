"use client";

import { trackProductEvent } from "../analytics/productAnalytics";
import { createBrowserSupabaseClient } from "../supabase/browser";

type AnonymousAuthTrigger =
  | "photo_store"
  | "handoff_create"
  | "account_create"
  | "backup";

type SupabaseUserLike = {
  id?: string;
  is_anonymous?: boolean;
};

type AnonymousSignInResult = {
  data?: {
    user?: SupabaseUserLike | null;
  } | null;
  error?: {
    message?: string;
  } | null;
};

export function isAnonymousAuthEnabled() {
  return process.env.NEXT_PUBLIC_ANON_AUTH_ENABLED === "true";
}

export function isAnonymousSupabaseUser(user: unknown) {
  return Boolean((user as SupabaseUserLike | null)?.is_anonymous);
}

export async function ensureAnonymousSession(trigger: AnonymousAuthTrigger) {
  if (!isAnonymousAuthEnabled()) {
    return null;
  }

  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) {
    return {
      created: false,
      isAnonymous: isAnonymousSupabaseUser(sessionData.session.user),
      userId: sessionData.session.user.id,
    };
  }

  const authWithAnonymous = supabase.auth as typeof supabase.auth & {
    signInAnonymously?: () => Promise<AnonymousSignInResult>;
  };

  if (typeof authWithAnonymous.signInAnonymously !== "function") {
    trackProductEvent("anonymous_auth_unavailable", { trigger });
    return null;
  }

  const { data, error } = await authWithAnonymous.signInAnonymously();
  if (error || !data?.user?.id) {
    trackProductEvent("anonymous_auth_failed", {
      trigger,
      error_code: "sign_in_failed",
      error_message: error?.message?.slice(0, 120) ?? "unknown",
    });
    return null;
  }

  trackProductEvent("anonymous_auth_created", { trigger });
  return {
    created: true,
    isAnonymous: true,
    userId: data.user.id,
  };
}
