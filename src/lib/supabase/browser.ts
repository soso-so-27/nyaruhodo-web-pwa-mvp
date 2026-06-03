import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { AUTH_STORAGE_KEY } from "../authDebug";
import { getSupabasePublicConfig } from "./config";

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient() {
  const config = getSupabasePublicConfig();

  if (!config || typeof window === "undefined") {
    return null;
  }

  browserClient ??= createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storage: window.localStorage,
      storageKey: AUTH_STORAGE_KEY,
    },
  });

  return browserClient;
}
