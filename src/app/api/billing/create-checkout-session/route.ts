import { NextResponse } from "next/server";

import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import { getBetaCapabilitiesForRequest } from "../../../../lib/betaAccess";
import {
  getBillingBaseUrl,
  isActiveBetaSupporterStatus,
  readLatestSubscriptionForUser,
  upsertCheckoutStartedSubscription,
} from "../../../../lib/billing/subscriptions";
import {
  createStripeCheckoutSession,
  createStripeCustomer,
  getStripePriceId,
  isStripeBillingConfigured,
} from "../../../../lib/billing/stripe";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUserForRequest(request);

  if (!user) {
    return billingError("login_required", 401);
  }

  const capabilities = await getBetaCapabilitiesForRequest(request);

  if (!capabilities.isBetaParticipant) {
    return billingError("beta_participant_required", 403);
  }

  if (!isStripeBillingConfigured()) {
    return billingError("billing_unavailable", 503);
  }

  const supabase = createSupabaseAdminClient();
  const priceId = getStripePriceId();

  if (!supabase || !priceId) {
    return billingError("billing_unavailable", 503);
  }

  const existing = await readLatestSubscriptionForUser(supabase, user.id);

  if (isActiveBetaSupporterStatus(existing?.status)) {
    return billingError("already_active", 409);
  }

  const customerId =
    existing?.stripeCustomerId ??
    (await createStripeCustomer({
      email: user.email,
      userId: user.id,
    })).id;

  const stored = await upsertCheckoutStartedSubscription({
    supabase,
    userId: user.id,
    stripeCustomerId: customerId,
  });

  if (!stored) {
    return billingError("subscription_store_failed", 500);
  }

  const baseUrl = getBillingBaseUrl(new URL(request.url).origin);
  const session = await createStripeCheckoutSession({
    customerId,
    priceId,
    userId: user.id,
    successUrl: `${baseUrl}/settings?billing=success`,
    cancelUrl: `${baseUrl}/settings?billing=cancel`,
  });

  if (!session.url) {
    return billingError("checkout_session_failed", 500);
  }

  return NextResponse.json({ url: session.url });
}

function billingError(
  error: string,
  status: 401 | 403 | 409 | 500 | 503,
) {
  return NextResponse.json({ ok: false, error }, { status });
}
