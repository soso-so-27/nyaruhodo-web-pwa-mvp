import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createBrowserSupabaseClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  browserClient ??= createBrowserClient(config.url, config.anonKey);

  return browserClient;
}
