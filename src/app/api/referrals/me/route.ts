import { NextResponse } from "next/server";

import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import { getOrCreateReferralSummary } from "../../../../lib/referrals/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSiteUrl } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUserForRequest(request);

  if (!user) {
    return NextResponse.json({
      isLoggedIn: false,
      referralEnabled: true,
      code: null,
      shareUrl: null,
      acceptedCount: 0,
    });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      {
        isLoggedIn: true,
        referralEnabled: false,
        code: null,
        shareUrl: null,
        acceptedCount: 0,
        error: "referral_store_unavailable",
      },
      { status: 503 },
    );
  }

  const summary = await getOrCreateReferralSummary(supabase, user.id);

  if (!summary) {
    return NextResponse.json(
      {
        isLoggedIn: true,
        referralEnabled: false,
        code: null,
        shareUrl: null,
        acceptedCount: 0,
        error: "referral_code_unavailable",
      },
      { status: 500 },
    );
  }

  const origin = request.headers.get("origin");
  const baseUrl = getSiteUrl(origin ?? undefined);

  return NextResponse.json({
    isLoggedIn: true,
    referralEnabled: true,
    code: summary.code,
    shareUrl: `${baseUrl}/onboarding?source=referral&ref=${encodeURIComponent(summary.code)}`,
    acceptedCount: summary.acceptedCount,
  });
}
