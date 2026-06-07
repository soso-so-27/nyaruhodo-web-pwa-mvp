import { NextResponse } from "next/server";

import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import {
  getBillingBaseUrl,
  readLatestSubscriptionForUser,
} from "../../../../lib/billing/subscriptions";
import {
  createStripePortalSession,
  isStripeBillingConfigured,
} from "../../../../lib/billing/stripe";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUserForRequest(request);

  if (!user) {
    return billingError("login_required", 401);
  }

  if (!isStripeBillingConfigured()) {
    return billingError("billing_unavailable", 503);
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return billingError("billing_unavailable", 503);
  }

  const subscription = await readLatestSubscriptionForUser(supabase, user.id);

  if (!subscription?.stripeCustomerId) {
    return billingError("customer_not_found", 404);
  }

  const baseUrl = getBillingBaseUrl(new URL(request.url).origin);
  const session = await createStripePortalSession({
    customerId: subscription.stripeCustomerId,
    returnUrl: `${baseUrl}/settings`,
  });

  if (!session.url) {
    return billingError("portal_session_failed", 500);
  }

  return NextResponse.json({ url: session.url });
}

function billingError(
  error: string,
  status: 401 | 404 | 500 | 503,
) {
  return NextResponse.json({ ok: false, error }, { status });
}
