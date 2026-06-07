import { NextResponse } from "next/server";

import {
  markSubscriptionPaymentFailed,
  upsertSubscriptionFromCheckoutSession,
  upsertSubscriptionFromStripeSubscription,
} from "../../../../lib/billing/subscriptions";
import {
  isStripeWebhookConfigured,
  readStripeObjectId,
  retrieveStripeSubscription,
  type StripeCheckoutSession,
  type StripeInvoicePayload,
  type StripeSubscriptionPayload,
  type StripeWebhookEvent,
  verifyStripeWebhookEvent,
} from "../../../../lib/billing/stripe";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
    return webhookError("webhook_unavailable", 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!verifyStripeWebhookEvent(rawBody, signature)) {
    return webhookError("invalid_signature", 400);
  }

  const event = JSON.parse(rawBody) as StripeWebhookEvent;
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return webhookError("server_unavailable", 503);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object as StripeCheckoutSession;
    const subscriptionId = readStripeObjectId(session.subscription);
    const subscription = subscriptionId
      ? await retrieveStripeSubscription(subscriptionId)
      : null;

    await upsertSubscriptionFromCheckoutSession({
      supabase,
      session,
      subscription,
    });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await upsertSubscriptionFromStripeSubscription({
      supabase,
      subscription: event.data?.object as StripeSubscriptionPayload,
    });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data?.object as StripeInvoicePayload;
    await markSubscriptionPaymentFailed({
      supabase,
      stripeCustomerId: readStripeObjectId(invoice.customer),
      stripeSubscriptionId: readStripeObjectId(invoice.subscription),
    });
  }

  return NextResponse.json({ ok: true });
}

function webhookError(error: string, status: 400 | 503) {
  return NextResponse.json({ ok: false, error }, { status });
}
