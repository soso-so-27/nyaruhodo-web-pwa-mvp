import { createBrowserSupabaseClient } from "./supabase/browser";

export type ClientBetaCapabilities = {
  isLoggedIn: boolean;
  isBetaParticipant: boolean;
  feedbackEnabled: boolean;
  supporterVoiceEnabled: boolean;
  isBetaSupporter: boolean;
};

export type BetaFeedbackCategory =
  | "good"
  | "confusing"
  | "bug"
  | "request"
  | "other";

export type SendBetaFeedbackInput = {
  category: BetaFeedbackCategory;
  message: string;
  kind?: "beta_feedback" | "supporter_voice";
};

export async function readClientBetaCapabilities() {
  const headers = await buildAuthHeaders();

  try {
    const response = await fetch("/api/beta/capabilities", { headers });

    if (!response.ok) {
      return getDefaultBetaCapabilities();
    }

    return {
      ...getDefaultBetaCapabilities(),
      ...((await response.json()) as Partial<ClientBetaCapabilities>),
    };
  } catch {
    return getDefaultBetaCapabilities();
  }
}

export async function sendBetaFeedback(input: SendBetaFeedbackInput) {
  const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch("/api/beta/feedback", {
    method: "POST",
    headers,
    body: JSON.stringify({
      category: input.category,
      message: input.message,
      kind: input.kind ?? "beta_feedback",
      page: typeof window !== "undefined" ? window.location.pathname : null,
      currentPath: typeof window !== "undefined" ? window.location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }),
  });

  if (!response.ok) {
    return false;
  }

  return true;
}

async function buildAuthHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  const supabase = createBrowserSupabaseClient();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  return headers;
}

function getDefaultBetaCapabilities(): ClientBetaCapabilities {
  return {
    isLoggedIn: false,
    isBetaParticipant: false,
    feedbackEnabled: false,
    supporterVoiceEnabled: false,
    isBetaSupporter: false,
  };
}
