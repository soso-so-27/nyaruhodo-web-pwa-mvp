import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

type RedeemHandoffBody = {
  token?: unknown;
};

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "handoff_store_unavailable" },
      { status: 503 },
    );
  }

  let body: RedeemHandoffBody;
  try {
    body = (await request.json()) as RedeemHandoffBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^onb_[a-f0-9-]{36}_[a-f0-9]{36}$/.test(token)) {
    return NextResponse.json(
      { ok: false, error: "invalid_token" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("onboarding_handoffs")
    .select("payload, expires_at, redeemed_at, redeem_count")
    .eq("handoff_token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "handoff_lookup_failed" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "handoff_not_found" },
      { status: 404 },
    );
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { ok: false, error: "handoff_expired" },
      { status: 410 },
    );
  }

  const now = new Date().toISOString();
  await supabase
    .from("onboarding_handoffs")
    .update({
      redeemed_at: data.redeemed_at ?? now,
      last_redeemed_at: now,
      redeem_count: Math.max(0, Number(data.redeem_count) || 0) + 1,
    })
    .eq("handoff_token", token);

  return NextResponse.json({
    ok: true,
    payload: data.payload,
  });
}
