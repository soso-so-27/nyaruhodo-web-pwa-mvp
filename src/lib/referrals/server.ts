import { randomInt } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

const REFERRAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const REFERRAL_CODE_LENGTH = 8;

export type ReferralSummary = {
  code: string;
  acceptedCount: number;
};

export async function getOrCreateReferralSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReferralSummary | null> {
  const code = await getOrCreateReferralCode(supabase, userId);

  if (!code) {
    return null;
  }

  const { count } = await supabase
    .from("referral_claims")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", userId);

  return {
    code,
    acceptedCount: count ?? 0,
  };
}

export async function claimReferralCode({
  supabase,
  code,
  referredUserId,
  referredEmail,
  anonymousId,
}: {
  supabase: SupabaseClient;
  code: string;
  referredUserId: string;
  referredEmail?: string | null;
  anonymousId?: string | null;
}) {
  const normalizedCode = normalizeReferralCode(code);

  if (!normalizedCode) {
    return { status: "invalid_code" as const };
  }

  const { data: referralCode, error: referralCodeError } = await supabase
    .from("referral_codes")
    .select("user_id,code")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (referralCodeError || !referralCode) {
    return { status: "not_found" as const };
  }

  const referrerUserId = String(referralCode.user_id);

  if (referrerUserId === referredUserId) {
    return { status: "self_referral" as const };
  }

  const { data: existingClaim } = await supabase
    .from("referral_claims")
    .select("id,referrer_user_id")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (existingClaim) {
    return {
      status: "already_claimed" as const,
      referrerUserId: String(existingClaim.referrer_user_id),
    };
  }

  const { error: insertError } = await supabase.from("referral_claims").insert({
    code: normalizedCode,
    referrer_user_id: referrerUserId,
    referred_user_id: referredUserId,
    anonymous_id: sanitizeAnonymousId(anonymousId),
  });

  if (insertError) {
    return { status: "failed" as const };
  }

  await markBetaParticipantInviter({
    supabase,
    email: referredEmail,
    referrerUserId,
  });

  return {
    status: "claimed" as const,
    referrerUserId,
  };
}

export function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const code = value.trim().toUpperCase().replace(/[^23456789A-Z]/g, "");

  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/.test(code)) {
    return null;
  }

  return code;
}

async function getOrCreateReferralCode(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: existingCode } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingCode?.code) {
    return String(existingCode.code);
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = createReferralCode();
    const { error } = await supabase.from("referral_codes").insert({
      user_id: userId,
      code,
    });

    if (!error) {
      return code;
    }
  }

  return null;
}

function createReferralCode() {
  let code = "";

  for (let index = 0; index < REFERRAL_CODE_LENGTH; index += 1) {
    code += REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)];
  }

  return code;
}

function sanitizeAnonymousId(value: string | null | undefined) {
  const anonymousId = value?.trim();

  if (!anonymousId) {
    return null;
  }

  return anonymousId.slice(0, 120);
}

async function markBetaParticipantInviter({
  supabase,
  email,
  referrerUserId,
}: {
  supabase: SupabaseClient;
  email?: string | null;
  referrerUserId: string;
}) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return;
  }

  await supabase
    .from("beta_participants")
    .update({ invited_by: referrerUserId, updated_at: new Date().toISOString() })
    .eq("email", normalizedEmail)
    .is("invited_by", null);
}
