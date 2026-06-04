import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "./config";

let adminClient: SupabaseClient | null = null;

export function createSupabaseAdminClient() {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!config || !serviceRoleKey) {
    return null;
  }

  adminClient ??= createClient(config.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
