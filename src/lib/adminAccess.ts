import { createClient, type User } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "./supabase/config";
import { createServerSupabaseClient } from "./supabase/server";

export type AdminCapabilities = {
  isAdmin: boolean;
  testToolsEnabled: boolean;
  stockAdminEnabled: boolean;
};

export type AdminAccessResult =
  | {
      allowed: true;
      capabilities: AdminCapabilities;
      user: User;
    }
  | {
      allowed: false;
      capabilities: AdminCapabilities;
      status: 403 | 404 | 503;
      error: "admin_disabled" | "admin_config_missing" | "admin_required";
    };

export async function getAdminCapabilitiesForRequest(
  request: Request,
): Promise<AdminCapabilities> {
  const user = await getAuthenticatedUserForRequest(request);
  const isAdmin = isAdminUser(user);

  return {
    isAdmin,
    testToolsEnabled: isAdmin && isEnvFlagEnabled("ENABLE_TEST_TOOLS"),
    stockAdminEnabled: isAdmin && isEnvFlagEnabled("ENABLE_STOCK_ADMIN"),
  };
}

export async function requireStockAdminAccess(
  request: Request,
): Promise<AdminAccessResult> {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!hasAdminEmailConfig()) {
    return {
      allowed: false,
      capabilities,
      status: 503,
      error: "admin_config_missing",
    };
  }

  if (!isEnvFlagEnabled("ENABLE_STOCK_ADMIN")) {
    return {
      allowed: false,
      capabilities,
      status: 404,
      error: "admin_disabled",
    };
  }

  const user = await getAuthenticatedUserForRequest(request);

  if (!user || !capabilities.isAdmin) {
    return {
      allowed: false,
      capabilities,
      status: 403,
      error: "admin_required",
    };
  }

  return { allowed: true, capabilities, user };
}

export async function requireAdminAccess(
  request: Request,
): Promise<AdminAccessResult> {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!hasAdminEmailConfig()) {
    return {
      allowed: false,
      capabilities,
      status: 503,
      error: "admin_config_missing",
    };
  }

  const user = await getAuthenticatedUserForRequest(request);

  if (!user || !capabilities.isAdmin) {
    return {
      allowed: false,
      capabilities,
      status: 403,
      error: "admin_required",
    };
  }

  return { allowed: true, capabilities, user };
}

export async function getAuthenticatedUserForRequest(request: Request) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const config = getSupabasePublicConfig();

    if (!config) {
      return null;
    }

    const supabase = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data, error } = await supabase.auth.getUser(bearerToken);

    if (!error && data.user) {
      return data.user;
    }
  }

  const serverSupabase = await createServerSupabaseClient();

  if (!serverSupabase) {
    return null;
  }

  const { data, error } = await serverSupabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user ?? null;
}

function isAdminUser(user: User | null) {
  const email = user?.email?.trim().toLowerCase();

  if (!email) {
    return false;
  }

  return getAdminEmails().has(email);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

function hasAdminEmailConfig() {
  return getAdminEmails().size > 0;
}

function getAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isEnvFlagEnabled(name: "ENABLE_TEST_TOOLS" | "ENABLE_STOCK_ADMIN") {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}
