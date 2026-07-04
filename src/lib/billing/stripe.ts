import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
};

export type StripeSubscriptionPayload = {
  id: string;
  customer?: string | { id?: string } | null;
  status?: string | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  } | null;
};

export type StripeInvoicePayload = {
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data?: {
    object?: unknown;
  };
};

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export class StripeRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly stripeType: string | null,
    public readonly code: string | null,
    public readonly param: string | null,
  ) {
    super(message);
    this.name = "StripeRequestError";
  }
}

export function readStripeRequestErrorDetails(error: unknown) {
  if (!(error instanceof StripeRequestError)) {
    return null;
  }

  return {
    status: error.status,
    type: error.stripeType,
    code: error.code,
    param: error.param,
  };
}

export function isStripeBillingConfigured() {
  return Boolean(
    isEnvFlagEnabled("ENABLE_BETA_SUPPORTER_BILLING") &&
      getStripeSecretKey() &&
      process.env.STRIPE_PRICE_ID_BETA_SUPPORTER?.trim(),
  );
}

export function isStripeWebhookConfigured() {
  return Boolean(getStripeWebhookSecret());
}

export function getStripePriceId() {
  return process.env.STRIPE_PRICE_ID_BETA_SUPPORTER?.trim() || null;
}

export async function createStripeCustomer({
  email,
  userId,
}: {
  email?: string | null;
  userId: string;
}) {
  const body = new URLSearchParams();

  if (email) {
    body.set("email", email);
  }

  body.set("metadata[user_id]", userId);

  return stripeRequest<{ id: string }>("/customers", {
    method: "POST",
    body,
  });
}

export async function createStripeCheckoutSession({
  customerId,
  priceId,
  userId,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const body = new URLSearchParams();

  body.set("mode", "subscription");
  body.set("customer", customerId);
  body.set("line_items[0][price]", priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("client_reference_id", userId);
  body.set("metadata[user_id]", userId);
  body.set("subscription_data[metadata][user_id]", userId);
  body.set("automatic_tax[enabled]", "true");
  body.set("billing_address_collection", "required");
  body.set("customer_update[address]", "auto");
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);

  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    body,
  });
}

export async function createStripePortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const body = new URLSearchParams();

  body.set("customer", customerId);
  body.set("return_url", returnUrl);

  return stripeRequest<{ id: string; url?: string | null }>(
    "/billing_portal/sessions",
    {
      method: "POST",
      body,
    },
  );
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return stripeRequest<StripeSubscriptionPayload>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: "GET",
    },
  );
}

export async function cancelStripeSubscription(subscriptionId: string) {
  return stripeRequest<StripeSubscriptionPayload>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: "DELETE",
    },
  );
}

export function verifyStripeWebhookEvent(rawBody: string, signature: string | null) {
  const webhookSecret = getStripeWebhookSecret();

  if (!webhookSecret || !signature) {
    return false;
  }

  const timestamp = readStripeSignaturePart(signature, "t");
  const signatures = readStripeSignatureParts(signature, "v1");

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return signatures.some((candidate) => timingSafeCompare(candidate, expected));
}

export function readStripeObjectId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }

  return null;
}

async function stripeRequest<T>(
  path: string,
  init: {
    method: "DELETE" | "GET" | "POST";
    body?: URLSearchParams;
  },
) {
  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    throw new Error("stripe_secret_missing");
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(init.body
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: init.body,
  });

  const json = (await response.json().catch(() => null)) as T | null;

  if (!response.ok || !json) {
    const stripeError = readStripeError(json);

    throw new StripeRequestError(
      "stripe_request_failed",
      response.status,
      stripeError?.type ?? null,
      stripeError?.code ?? null,
      stripeError?.param ?? null,
    );
  }

  return json;
}

function readStripeError(json: unknown) {
  if (!json || typeof json !== "object" || !("error" in json)) {
    return null;
  }

  const error = json.error;

  if (!error || typeof error !== "object") {
    return null;
  }

  return {
    type:
      "type" in error && typeof error.type === "string" ? error.type : null,
    code:
      "code" in error && typeof error.code === "string" ? error.code : null,
    param:
      "param" in error && typeof error.param === "string" ? error.param : null,
  };
}

function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

function isEnvFlagEnabled(name: "ENABLE_BETA_SUPPORTER_BILLING") {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

function readStripeSignaturePart(signature: string, key: string) {
  return readStripeSignatureParts(signature, key)[0] ?? null;
}

function readStripeSignatureParts(signature: string, key: string) {
  return signature
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${key}=`))
    .map((part) => part.slice(key.length + 1))
    .filter(Boolean);
}

function timingSafeCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}
