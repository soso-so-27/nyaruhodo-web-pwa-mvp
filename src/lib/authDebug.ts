import type { SupabaseClient } from "@supabase/supabase-js";

import { getDisplayEnvironment } from "./displayEnvironment";
import { STORAGE_KEYS } from "./storage";

export const AUTH_STORAGE_KEY = "nyaruhodo_supabase_auth";
export const AUTH_CODE_VERIFIER_STORAGE_KEY = `${AUTH_STORAGE_KEY}-code-verifier`;

const AUTH_DEBUG_STORAGE_KEY = "auth_debug_latest";

export type AuthDebugEvent = {
  event: string;
  details?: Record<string, unknown>;
  at: string;
};

export type AuthDebugSnapshot = {
  environment: string;
  origin: string;
  path: string;
  authStoragePresent: boolean;
  authStorageLength: number;
  codeVerifierPresent: boolean;
  pendingMarkerPresent: boolean;
  sessionPresent: boolean;
  userPresent: boolean;
  userEmail: string | null;
  sessionError: string | null;
  userError: string | null;
  latestEvent: AuthDebugEvent | null;
};

export function writeAuthDebugEvent(
  event: string,
  details?: Record<string, unknown>,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: AuthDebugEvent = {
      event,
      details,
      at: new Date().toISOString(),
    };

    window.localStorage.setItem(AUTH_DEBUG_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Debug state should never block auth.
  }
}

export function readAuthDebugEvent() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_DEBUG_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AuthDebugEvent>) : null;

    if (!parsed || typeof parsed.event !== "string" || typeof parsed.at !== "string") {
      return null;
    }

    return {
      event: parsed.event,
      details:
        parsed.details && typeof parsed.details === "object"
          ? parsed.details
          : undefined,
      at: parsed.at,
    } satisfies AuthDebugEvent;
  } catch {
    return null;
  }
}

export async function buildAuthDebugSnapshot(
  supabase: SupabaseClient | null,
): Promise<AuthDebugSnapshot> {
  const authStorageValue =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(AUTH_STORAGE_KEY);
  const codeVerifierValue =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(AUTH_CODE_VERIFIER_STORAGE_KEY);
  const pendingValue =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(STORAGE_KEYS.authGooglePending);
  let sessionPresent = false;
  let userPresent = false;
  let userEmail: string | null = null;
  let sessionError: string | null = null;
  let userError: string | null = null;

  if (supabase) {
    const sessionResult = await supabase.auth.getSession();
    sessionPresent = Boolean(sessionResult.data.session);
    sessionError = sessionResult.error?.message ?? null;

    const userResult = await supabase.auth.getUser();
    userPresent = Boolean(userResult.data.user);
    userEmail = userResult.data.user?.email ?? null;
    userError = userResult.error?.message ?? null;
  }

  return {
    environment: getDisplayEnvironment(),
    origin: typeof window === "undefined" ? "" : window.location.origin,
    path:
      typeof window === "undefined"
        ? ""
        : `${window.location.pathname}${window.location.search}`,
    authStoragePresent: Boolean(authStorageValue),
    authStorageLength: authStorageValue?.length ?? 0,
    codeVerifierPresent: Boolean(codeVerifierValue),
    pendingMarkerPresent: Boolean(pendingValue),
    sessionPresent,
    userPresent,
    userEmail,
    sessionError,
    userError,
    latestEvent: readAuthDebugEvent(),
  };
}
