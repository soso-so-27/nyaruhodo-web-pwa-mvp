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

export async function startBetaSupporterCheckout() {
  const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch("/api/billing/create-checkout-session", {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as {
    url?: string;
  } | null;

  return data?.url ?? null;
}

export async function openBillingPortal() {
  const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch("/api/billing/create-portal-session", {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as {
    url?: string;
  } | null;

  return data?.url ?? null;
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
