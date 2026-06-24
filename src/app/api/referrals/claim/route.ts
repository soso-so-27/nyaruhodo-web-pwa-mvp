import { NextResponse } from "next/server";

import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import { claimReferralCode } from "../../../../lib/referrals/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUserForRequest(request);

  if (!user) {
    return NextResponse.json(
      {
        claimed: false,
        status: "login_required",
      },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      {
        claimed: false,
        status: "referral_store_unavailable",
      },
      { status: 503 },
    );
  }

  let body: {
    code?: unknown;
    anonymousId?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      {
        claimed: false,
        status: "invalid_body",
      },
      { status: 400 },
    );
  }

  const result = await claimReferralCode({
    supabase,
    code: typeof body.code === "string" ? body.code : "",
    referredUserId: user.id,
    referredEmail: user.email,
    anonymousId: typeof body.anonymousId === "string" ? body.anonymousId : null,
  });

  const httpStatus =
    result.status === "invalid_code"
      ? 400
      : result.status === "not_found"
        ? 404
        : result.status === "failed"
          ? 500
          : 200;

  return NextResponse.json(
    {
      claimed: result.status === "claimed",
      status: result.status,
    },
    { status: httpStatus },
  );
}
