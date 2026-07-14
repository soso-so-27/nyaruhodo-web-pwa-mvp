import { createBrowserSupabaseClient } from "./supabase/browser";

export type ClientBillingStatus = {
  isLoggedIn: boolean;
  billingConfigured: boolean;
  isBetaSupporter: boolean;
  status:
    | "none"
    | "checkout_started"
    | "incomplete"
    | "incomplete_expired"
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "paused";
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canManageBilling: boolean;
};

export type BillingNavigationResult =
  | { ok: true; url: string }
  | {
      ok: false;
      reason:
        | "login_required"
        | "forbidden"
        | "not_found"
        | "network"
        | "unavailable";
    };

export async function readClientBillingStatus() {
  const headers = await buildAuthHeaders();

  try {
    const response = await fetch("/api/billing/status", { headers });

    if (!response.ok) {
      return getDefaultBillingStatus();
    }

    return {
      ...getDefaultBillingStatus(),
      ...((await response.json()) as Partial<ClientBillingStatus>),
    };
  } catch {
    return getDefaultBillingStatus();
  }
}

export async function startBetaSupporterCheckout(): Promise<BillingNavigationResult> {
  const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch("/api/billing/create-checkout-session", {
    method: "POST",
    headers,
  }).catch(() => null);

  if (!response) {
    return { ok: false, reason: "network" };
  }

  if (!response.ok) {
    return { ok: false, reason: getBillingFailureReason(response.status) };
  }

  const data = (await response.json().catch(() => null)) as {
    url?: string;
  } | null;

  return data?.url
    ? { ok: true, url: data.url }
    : { ok: false, reason: "unavailable" };
}

export async function openBillingPortal(): Promise<BillingNavigationResult> {
  const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch("/api/billing/create-portal-session", {
    method: "POST",
    headers,
  }).catch(() => null);

  if (!response) {
    return { ok: false, reason: "network" };
  }

  if (!response.ok) {
    return { ok: false, reason: getBillingFailureReason(response.status) };
  }

  const data = (await response.json().catch(() => null)) as {
    url?: string;
  } | null;

  return data?.url
    ? { ok: true, url: data.url }
    : { ok: false, reason: "unavailable" };
}

async function buildAuthHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  const supabase = createBrowserSupabaseClient();

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    } catch {
      // The API will return 401 and the caller can show the login recovery path.
    }
  }

  return headers;
}

function getDefaultBillingStatus(): ClientBillingStatus {
  return {
    isLoggedIn: false,
    billingConfigured: false,
    isBetaSupporter: false,
    status: "none",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canManageBilling: false,
  };
}

function getBillingFailureReason(status: number) {
  if (status === 401) {
    return "login_required" as const;
  }

  if (status === 403) {
    return "forbidden" as const;
  }

  if (status === 404) {
    return "not_found" as const;
  }

  return "unavailable" as const;
}
