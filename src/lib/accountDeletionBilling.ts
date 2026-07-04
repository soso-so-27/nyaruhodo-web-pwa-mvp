import type { SupabaseClient } from "@supabase/supabase-js";

import {
  readLatestSubscriptionForUser,
  type BetaSupporterSubscription,
} from "./billing/subscriptions";
import {
  cancelStripeSubscription,
  readStripeRequestErrorDetails,
} from "./billing/stripe";

const STRIPE_TERMINAL_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "incomplete_expired",
  "none",
]);

export type AccountDeletionBillingResult = {
  cancelledStripeSubscriptions: number;
  errors: string[];
};

export async function cancelAccountDeletionStripeSubscriptions({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<AccountDeletionBillingResult> {
  const subscription = await readLatestSubscriptionForUser(supabase, userId);

  if (!isAccountDeletionStripeCancellationRequired(subscription)) {
    return {
      cancelledStripeSubscriptions: 0,
      errors: [],
    };
  }

  const stripeSubscriptionId = subscription?.stripeSubscriptionId;

  if (!stripeSubscriptionId) {
    return {
      cancelledStripeSubscriptions: 0,
      errors: [],
    };
  }

  try {
    await cancelStripeSubscription(stripeSubscriptionId);

    return {
      cancelledStripeSubscriptions: 1,
      errors: [],
    };
  } catch (error) {
    const stripeDetails = readStripeRequestErrorDetails(error);
    const detailText = stripeDetails
      ? ` status=${stripeDetails.status} type=${stripeDetails.type ?? "-"} code=${stripeDetails.code ?? "-"}`
      : "";

    return {
      cancelledStripeSubscriptions: 0,
      errors: [`stripe subscription cancel failed:${detailText}`],
    };
  }
}

export function isAccountDeletionStripeCancellationRequired(
  subscription: BetaSupporterSubscription | null | undefined,
) {
  return Boolean(
    subscription?.stripeSubscriptionId &&
      !STRIPE_TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status),
  );
}
