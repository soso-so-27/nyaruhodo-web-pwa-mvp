import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "../supabase/admin";
import { getSiteUrl } from "../supabase/config";
import {
  getStripePriceId,
  readStripeObjectId,
  type StripeCheckoutSession,
  type StripeSubscriptionPayload,
} from "./stripe";

export type SubscriptionStatus =
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

export type BetaSupporterSubscription = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export function isActiveBetaSupporterStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export function isCurrentBetaSupporterSubscription(
  subscription: Pick<BetaSupporterSubscription, "status" | "priceId"> | null | undefined,
) {
  const currentPriceId = getStripePriceId();

  return Boolean(
    currentPriceId &&
      isActiveBetaSupporterStatus(subscription?.status) &&
      subscription?.priceId === currentPriceId,
  );
}

export async function getLatestSubscriptionForUser(userId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  return readLatestSubscriptionForUser(supabase, userId);
}

export async function isUserBetaSupporter(userId: string) {
  const subscription = await getLatestSubscriptionForUser(userId);

  return isCurrentBetaSupporterSubscription(subscription);
}

export async function readLatestSubscriptionForUser(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "user_id,stripe_customer_id,stripe_subscription_id,status,price_id,current_period_end,cancel_at_period_end",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapSubscriptionRow(data);
}

export async function readSubscriptionByStripeCustomerId(
  supabase: SupabaseClient,
  stripeCustomerId: string,
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "user_id,stripe_customer_id,stripe_subscription_id,status,price_id,current_period_end,cancel_at_period_end",
    )
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapSubscriptionRow(data);
}

export async function readSubscriptionByStripeSubscriptionId(
  supabase: SupabaseClient,
  stripeSubscriptionId: string,
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "user_id,stripe_customer_id,stripe_subscription_id,status,price_id,current_period_end,cancel_at_period_end",
    )
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapSubscriptionRow(data);
}

export async function upsertCheckoutStartedSubscription({
  supabase,
  userId,
  stripeCustomerId,
}: {
  supabase: SupabaseClient;
  userId: string;
  stripeCustomerId: string;
}) {
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      status: "checkout_started",
      price_id: getStripePriceId(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return !error;
}

export async function upsertSubscriptionFromCheckoutSession({
  supabase,
  session,
  subscription,
}: {
  supabase: SupabaseClient;
  session: StripeCheckoutSession;
  subscription?: StripeSubscriptionPayload | null;
}) {
  const userId = readUserIdFromCheckoutSession(session);
  const stripeCustomerId = readStripeObjectId(session.customer);
  const stripeSubscriptionId =
    readStripeObjectId(session.subscription) ?? subscription?.id ?? null;

  if (!userId || !stripeCustomerId) {
    return false;
  }

  return upsertSubscriptionRecord({
    supabase,
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
    status: readSubscriptionStatus(subscription?.status, "active"),
    priceId: readSubscriptionPriceId(subscription) ?? getStripePriceId(),
    currentPeriodEnd: readSubscriptionPeriodEnd(subscription),
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
  });
}

export async function upsertSubscriptionFromStripeSubscription({
  supabase,
  subscription,
}: {
  supabase: SupabaseClient;
  subscription: StripeSubscriptionPayload;
}) {
  const stripeCustomerId = readStripeObjectId(subscription.customer);
  const stripeSubscriptionId = subscription.id;
  const userIdFromMetadata = subscription.metadata?.user_id ?? null;
  const existing =
    stripeSubscriptionId
      ? await readSubscriptionByStripeSubscriptionId(supabase, stripeSubscriptionId)
      : null;
  const existingByCustomer =
    !existing && stripeCustomerId
      ? await readSubscriptionByStripeCustomerId(supabase, stripeCustomerId)
      : null;
  const userId = userIdFromMetadata ?? existing?.userId ?? existingByCustomer?.userId;

  if (!userId || !stripeCustomerId) {
    return false;
  }

  return upsertSubscriptionRecord({
    supabase,
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
    status: readSubscriptionStatus(subscription.status, "incomplete"),
    priceId: readSubscriptionPriceId(subscription) ?? getStripePriceId(),
    currentPeriodEnd: readSubscriptionPeriodEnd(subscription),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  });
}

export async function markSubscriptionPaymentFailed({
  supabase,
  stripeCustomerId,
  stripeSubscriptionId,
}: {
  supabase: SupabaseClient;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}) {
  const existing =
    stripeSubscriptionId
      ? await readSubscriptionByStripeSubscriptionId(supabase, stripeSubscriptionId)
      : null;
  const existingByCustomer =
    !existing && stripeCustomerId
      ? await readSubscriptionByStripeCustomerId(supabase, stripeCustomerId)
      : null;
  const subscription = existing ?? existingByCustomer;

  if (!subscription) {
    return false;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", subscription.userId);

  return !error;
}

export function getBillingBaseUrl(origin?: string | null) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    getSiteUrl(origin ?? undefined)
  );
}

async function upsertSubscriptionRecord({
  supabase,
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  priceId,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: {
  supabase: SupabaseClient;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}) {
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      status,
      price_id: priceId,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return !error;
}

function mapSubscriptionRow(row: Record<string, unknown>): BetaSupporterSubscription {
  return {
    userId: String(row.user_id),
    stripeCustomerId: String(row.stripe_customer_id),
    stripeSubscriptionId:
      typeof row.stripe_subscription_id === "string"
        ? row.stripe_subscription_id
        : null,
    status: readSubscriptionStatus(row.status, "none"),
    priceId: typeof row.price_id === "string" ? row.price_id : null,
    currentPeriodEnd:
      typeof row.current_period_end === "string"
        ? row.current_period_end
        : null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

function readUserIdFromCheckoutSession(session: StripeCheckoutSession) {
  return session.client_reference_id ?? session.metadata?.user_id ?? null;
}

function readSubscriptionStatus(
  value: unknown,
  fallback: SubscriptionStatus,
): SubscriptionStatus {
  return isKnownSubscriptionStatus(value) ? value : fallback;
}

function isKnownSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (
    value === "checkout_started" ||
    value === "incomplete" ||
    value === "incomplete_expired" ||
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "unpaid" ||
    value === "paused" ||
    value === "none"
  );
}

function readSubscriptionPriceId(subscription?: StripeSubscriptionPayload | null) {
  return subscription?.items?.data?.[0]?.price?.id ?? null;
}

function readSubscriptionPeriodEnd(subscription?: StripeSubscriptionPayload | null) {
  const periodEnd = subscription?.current_period_end;

  return typeof periodEnd === "number"
    ? new Date(periodEnd * 1000).toISOString()
    : null;
}
