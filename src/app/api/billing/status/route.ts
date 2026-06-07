import { NextResponse } from "next/server";

import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import {
  getLatestSubscriptionForUser,
  isActiveBetaSupporterStatus,
} from "../../../../lib/billing/subscriptions";
import { isStripeBillingConfigured } from "../../../../lib/billing/stripe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUserForRequest(request);

  if (!user) {
    return NextResponse.json({
      isLoggedIn: false,
      billingConfigured: isStripeBillingConfigured(),
      isBetaSupporter: false,
      status: "none",
      canManageBilling: false,
    });
  }

  const subscription = await getLatestSubscriptionForUser(user.id);
  const status = subscription?.status ?? "none";

  return NextResponse.json({
    isLoggedIn: true,
    billingConfigured: isStripeBillingConfigured(),
    isBetaSupporter: isActiveBetaSupporterStatus(status),
    status,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    canManageBilling: Boolean(subscription?.stripeCustomerId),
  });
}
