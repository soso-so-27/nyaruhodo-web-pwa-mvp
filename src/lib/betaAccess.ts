import type { User } from "@supabase/supabase-js";

import {
  getAdminCapabilitiesForRequest,
  getAuthenticatedUserForRequest,
} from "./adminAccess";
import { isUserBetaSupporter } from "./billing/subscriptions";

export type BetaCapabilities = {
  isLoggedIn: boolean;
  isBetaParticipant: boolean;
  feedbackEnabled: boolean;
  supporterVoiceEnabled: boolean;
  isBetaSupporter: boolean;
};

export type BetaAccessResult =
  | {
      allowed: true;
      capabilities: BetaCapabilities;
      user: User;
    }
  | {
      allowed: false;
      capabilities: BetaCapabilities;
      status: 401 | 403;
      error:
        | "login_required"
        | "beta_participant_required"
        | "supporter_voice_unavailable";
    };

export async function getBetaCapabilitiesForRequest(
  request: Request,
): Promise<BetaCapabilities> {
  const user = await getAuthenticatedUserForRequest(request);
  const adminCapabilities = await getAdminCapabilitiesForRequest(request);
  const isBetaParticipant =
    Boolean(user) && (adminCapabilities.isAdmin || isBetaTesterEmail(user?.email));
  const isBetaSupporter = user ? await isUserBetaSupporter(user.id) : false;

  return {
    isLoggedIn: Boolean(user),
    isBetaParticipant,
    feedbackEnabled: isBetaParticipant,
    supporterVoiceEnabled: isBetaSupporter,
    isBetaSupporter,
  };
}

export async function requireBetaFeedbackAccess(
  request: Request,
  kind: "beta_feedback" | "supporter_voice",
): Promise<BetaAccessResult> {
  const user = await getAuthenticatedUserForRequest(request);
  const capabilities = await getBetaCapabilitiesForRequest(request);

  if (!user) {
    return {
      allowed: false,
      capabilities,
      status: 401,
      error: "login_required",
    };
  }

  if (kind === "supporter_voice" && !capabilities.supporterVoiceEnabled) {
    return {
      allowed: false,
      capabilities,
      status: 403,
      error: "supporter_voice_unavailable",
    };
  }

  if (kind === "beta_feedback" && !capabilities.isBetaParticipant) {
    return {
      allowed: false,
      capabilities,
      status: 403,
      error: "beta_participant_required",
    };
  }

  return { allowed: true, capabilities, user };
}

function isBetaTesterEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  return getBetaTesterEmails().has(normalizedEmail);
}

function getBetaTesterEmails() {
  return new Set(
    (process.env.BETA_TESTER_EMAILS ?? "")
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
