"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AppLoadingScreen } from "../../../components/loading/AppLoadingScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { AppCard } from "../../../components/ui/AppCard";
import { WordmarkHeader } from "../../../components/ui/AppHeader";
import {
  getActiveCatProfile,
  isCatProfileNameUnset,
  readActiveCatId,
  readCatProfiles,
} from "../../../components/home/homeInputHelpers";
import {
  APP_ACCENT,
  APP_PAGE_BACKGROUND,
} from "../../../components/ui/appTheme";
import { STORAGE_KEYS } from "../../../lib/storage";
import { trackProductEvent } from "../../../lib/analytics/productAnalytics";
import { writeAuthDebugEvent } from "../../../lib/authDebug";
import {
  markOnboardingAlbumCreated,
  normalizeOnboardingSource,
  type OnboardingSource,
} from "../../../lib/onboarding/progress";
import { createOnboardingHandoff } from "../../../lib/onboarding/handoff";
import { claimPendingReferral } from "../../../lib/referrals/client";
import {
  getDisplayEnvironment,
  getDisplayEnvironmentLabel,
  type DisplayEnvironment,
} from "../../../lib/displayEnvironment";
import { createBrowserSupabaseClient } from "../../../lib/supabase/browser";

const ACCOUNT_CREATE_PROMPT_DISMISSED_KEY =
  STORAGE_KEYS.accountCreatePromptDismissed;
const ACCOUNT_CREATE_PROMPT_DISMISSED_MS = 7 * 24 * 60 * 60 * 1000;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_ID_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const ONBOARDING_ALBUM_COMPLETION_READY_KEY =
  "neteruneko_onboarding_album_completion_ready";

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleAccountsId = {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    use_fedcm_for_prompt?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      shape?: "rectangular" | "pill" | "circle" | "square";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      width?: number;
      locale?: string;
    },
  ): void;
  prompt(): void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

export default function AccountCreatePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isStartingAuth, setIsStartingAuth] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);
  const [isAccountConnected, setIsAccountConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [displayEnvironment, setDisplayEnvironment] =
    useState<DisplayEnvironment>("unknown");
  const [isFromOnboarding, setIsFromOnboarding] = useState(false);
  const [onboardingSource, setOnboardingSource] =
    useState<OnboardingSource>("direct");
  const [onboardingCatName, setOnboardingCatName] = useState("");
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const hasTrackedCtaView = useRef(false);
  const hasTrackedOnboardingPromptView = useRef(false);
  const hasTrackedCallbackError = useRef(false);

  const hasOnboardingCatName = onboardingCatName.trim().length > 0;
  const onboardingAlbumTitle = hasOnboardingCatName
    ? `${onboardingCatName.trim()}のアルバムをつくる`
    : "うちのこのアルバムをつくる";
  const onboardingAlbumBody = hasOnboardingCatName
    ? `${onboardingCatName.trim()}のねがおを\nあとから見返せるようにします。\n\n届いたねこだよりも、あとから見返せます。`
    : "今日のねがおを\nあとから見返せるようにします。\n\n届いたねこだよりも、あとから見返せます。";

  function markOnboardingAlbumCompletionReady() {
    window.sessionStorage.setItem(ONBOARDING_ALBUM_COMPLETION_READY_KEY, "true");
  }

  function trackOnboardingAlbumCreatedVariant(method: string) {
    trackProductEvent(
      hasOnboardingCatName
        ? "album_created_with_name"
        : "album_created_without_name",
      {
        source: onboardingSource,
        method,
        surface: "onboarding",
      },
    );
  }

  const hasInitializedGoogleButton = useRef(false);

  useEffect(() => {
    setDisplayEnvironment(getDisplayEnvironment());
    const fromOnboarding =
      new URLSearchParams(window.location.search).get("from") === "onboarding";
    const source = readOnboardingSourceFromLocation();
    let catName = "";

    if (fromOnboarding) {
      const activeProfile = getActiveCatProfile(
        readCatProfiles(),
        readActiveCatId(),
      );

      if (!isCatProfileNameUnset(activeProfile)) {
        catName = activeProfile.name.trim();
        setOnboardingCatName(catName);
      }
    }

    setIsFromOnboarding(fromOnboarding);
    setOnboardingSource(source);

    if (fromOnboarding && !hasTrackedOnboardingPromptView.current) {
      hasTrackedOnboardingPromptView.current = true;
      trackProductEvent("onboarding_album_create_prompt_view", {
        source,
      });
      trackProductEvent("onboarding_album_prompt_view", {
        source,
      });
      trackProductEvent(
        catName ? "album_prompt_view_with_name" : "album_prompt_view_without_name",
        {
          source,
          surface: "onboarding",
        },
      );
    }

    let isMounted = true;

    async function checkAccountConnection() {
      const supabase = createBrowserSupabaseClient();

      if (!supabase) {
        if (isMounted) {
          setIsCheckingAccount(false);
        }
        return;
      }

      const { data, error } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (!error && data.user) {
        setIsAccountConnected(true);
        setConnectedEmail(data.user.email ?? "");
      }

      setIsCheckingAccount(false);
    }

    void checkAccountConnection();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (hasTrackedCtaView.current || isCheckingAccount || isAccountConnected) {
      return;
    }

    hasTrackedCtaView.current = true;
    trackProductEvent("account_create_cta_viewed", {
      route: "/account/create",
      trigger: "account_create_page",
    });
  }, [isAccountConnected, isCheckingAccount]);

  useEffect(() => {
    if (hasTrackedCallbackError.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "auth") {
      return;
    }

    hasTrackedCallbackError.current = true;
    trackProductEvent("auth_google_failed", {
      error_type: "callback_failed",
    });
    setMessage(
      "Googleログインを完了できませんでした。少し時間をおいてもう一度お試しください。",
    );
  }, []);

  async function handleGoogleSignIn() {
    if (isFromOnboarding) {
      trackProductEvent("onboarding_google_continue_click", {
        source: onboardingSource,
        method: "oauth_redirect",
      });
    }

    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      setMessage("アカウント接続の準備がまだできていません。");
      return;
    }

    setIsStartingAuth(true);
    setMessage("");
    window.localStorage.setItem(
      STORAGE_KEYS.authGooglePending,
      JSON.stringify({
        provider: "google",
        route: "/account/create",
        method: "oauth_redirect",
        startedAt: new Date().toISOString(),
      }),
    );
    trackProductEvent("auth_google_started", {
      route: "/account/create",
      method: "oauth_redirect",
    });

    const redirectTo = createAuthCallbackUrl({
      nextPath: isFromOnboarding
        ? `/account/create?from=onboarding&source=${encodeURIComponent(
            onboardingSource,
          )}`
        : "/home",
    });

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      writeAuthDebugEvent("oauth_redirect_failed", {
        message: error.message,
      });
      trackProductEvent("auth_google_failed", {
        error_type: "oauth_redirect_failed",
        error_message: error.message,
      });
      window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
      setIsStartingAuth(false);
      setMessage("Googleログインを開始できませんでした。少し時間をおいてもう一度お試しください。");
    }
  }

  async function handleGoogleCredential(response: GoogleCredentialResponse) {
    trackProductEvent("account_create_cta_clicked", {
      route: "/account/create",
      trigger: "google_identity_button",
    });
    if (isFromOnboarding) {
      trackProductEvent("onboarding_google_continue_click", {
        source: onboardingSource,
        method: "google_identity_button",
      });
    }

    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      setMessage("アカウント接続の準備がまだできていません。");
      return;
    }

    setIsStartingAuth(true);
    setMessage("");
    trackProductEvent("auth_google_started", {
      route: "/account/create",
      method: "id_token",
    });

    if (!response.credential) {
      writeAuthDebugEvent("gis_credential_missing", {
        selectBy: response.select_by ?? null,
      });
      trackProductEvent("auth_google_failed", {
        error_type: "missing_google_credential",
      });
      setIsStartingAuth(false);
      setMessage("Googleログイン情報を受け取れませんでした。もう一度お試しください。");
      return;
    }

    writeAuthDebugEvent("gis_credential_received", {
      selectBy: response.select_by ?? null,
    });

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: response.credential,
    });

    if (error) {
      writeAuthDebugEvent("gis_id_token_failed", {
        message: error.message,
      });
      trackProductEvent("auth_google_failed", {
        error_type: "id_token_sign_in_failed",
        error_message: error.message,
      });
      setIsStartingAuth(false);
      setMessage(
        "Googleログインを開始できませんでした。少し時間をおいてもう一度お試しください。",
      );
      return;
    }

    writeAuthDebugEvent("gis_id_token_succeeded", {
      hasSession: Boolean(data.session),
      hasUser: Boolean(data.user),
      email: data.user?.email ?? null,
    });
    window.localStorage.setItem(
      STORAGE_KEYS.authGooglePending,
      JSON.stringify({
        provider: "google",
        route: "/account/create",
        method: "id_token",
        startedAt: new Date().toISOString(),
      }),
    );
    if (isFromOnboarding) {
      markOnboardingAlbumCompletionReady();
      markOnboardingAlbumCreated(onboardingSource);
      trackProductEvent("onboarding_album_created", {
        source: onboardingSource,
        method: "google",
      });
      trackProductEvent("cat_album_created", {
        source: onboardingSource,
        method: "google",
      });
      trackProductEvent("onboarding_completed", {
        source: onboardingSource,
        method: "google",
      });
      trackOnboardingAlbumCreatedVariant("google");
    }
    await claimPendingReferral();
    router.replace(
      isFromOnboarding ? "/cats?onboarding=1" : "/home?auth=google_success",
    );
  }

  async function handleLater() {
    if (isFromOnboarding) {
      trackProductEvent("onboarding_skip", {
        source: onboardingSource,
        state: "account_create",
      });
      trackProductEvent("onboarding_skip_click", {
        source: onboardingSource,
        state: "account_create",
      });

      setIsStartingAuth(true);
      setMessage("");

      try {
        const handoff = await createOnboardingHandoff({
          source: onboardingSource,
          markCompleted: true,
        });

        markOnboardingAlbumCompletionReady();
        trackProductEvent("onboarding_album_created", {
          source: onboardingSource,
          method: "handoff",
        });
        trackProductEvent("cat_album_created", {
          source: onboardingSource,
          method: "handoff",
        });
        trackProductEvent("onboarding_completed", {
          source: onboardingSource,
          method: "handoff",
        });
        trackOnboardingAlbumCreatedVariant("handoff");
        router.push(`${handoff.continueUrl}&handoff_from=account`);
      } catch {
        setIsStartingAuth(false);
        setMessage(
          "つづきの準備ができませんでした。少し時間をおいて、もう一度お試しください。",
        );
      }

      return;
    }

    window.localStorage.setItem(
      ACCOUNT_CREATE_PROMPT_DISMISSED_KEY,
      JSON.stringify({
        dismissedAt: new Date().toISOString(),
        dismissedUntil: new Date(
          Date.now() + ACCOUNT_CREATE_PROMPT_DISMISSED_MS,
        ).toISOString(),
      }),
    );
    router.push("/home");
  }

  if (isCheckingAccount) {
    return <AppLoadingScreen variant="account" />;
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {isFromOnboarding ? <WordmarkHeader style={styles.wordmarkHeader} /> : null}
        <AppCard variant="section" padding="lg" style={styles.card}>
          {isAccountConnected ? (
            <>
              <p style={styles.eyebrow}>アカウント</p>
              <h1 style={styles.title}>
                {isFromOnboarding
                  ? onboardingAlbumTitle
                  : "Googleアカウントにログイン中です"}
              </h1>
              <p style={styles.body}>
                {isFromOnboarding
                  ? onboardingAlbumBody
                  : "この端末のねがおを、アカウントに保存できます。別の端末でも復元できます。"}
              </p>
              {connectedEmail ? (
                <p style={styles.connectedEmail}>{connectedEmail}</p>
              ) : null}
              {!isFromOnboarding ? (
                <EnvironmentNotice environment={displayEnvironment} />
              ) : null}
              <div style={styles.actions}>
                <div ref={googleButtonRef} style={styles.googleButtonMount} />
                {isFromOnboarding ? (
                  <AppButton
                    type="button"
                    onClick={() => {
                      markOnboardingAlbumCompletionReady();
                      markOnboardingAlbumCreated(onboardingSource);
                      trackProductEvent("onboarding_album_created", {
                        source: onboardingSource,
                        method: "already_connected",
                      });
                      trackProductEvent("cat_album_created", {
                        source: onboardingSource,
                        method: "already_connected",
                      });
                      trackProductEvent("onboarding_completed", {
                        source: onboardingSource,
                        method: "already_connected",
                      });
                      trackOnboardingAlbumCreatedVariant("already_connected");
                      router.push("/cats?onboarding=1");
                    }}
                    fullWidth
                  >
                    アルバムへ進む
                  </AppButton>
                ) : (
                  <AppButton
                    type="button"
                    onClick={() => {
                      router.push("/home");
                    }}
                    variant="primary"
                    fullWidth
                  >
                    ホームへ戻る
                  </AppButton>
                )}
              </div>
            </>
          ) : (
            <>
              <p style={styles.eyebrow}>
                {isFromOnboarding ? "つづき" : "ねてるねこの保存"}
              </p>
              <h1 style={styles.title}>
                {isFromOnboarding
                  ? onboardingAlbumTitle
                  : "ねがおを、あとから見返せるように"}
              </h1>
              <p style={styles.body}>
                {isFromOnboarding
                  ? onboardingAlbumBody
                  : "Googleアカウントで接続すると、この端末のねがおを保存できます。別の端末でも、とったねがおやとどいたねがおを復元できます。"}
              </p>
              {!isFromOnboarding ? (
                <div style={styles.valueList} aria-label="保存できるもの">
                  {[
                    "とったねがお",
                    "とどいたねがお",
                    "猫のプロフィール",
                    "写真と記録",
                  ].map((item) => (
                    <div key={item} style={styles.valueItem}>
                      <span style={styles.valueDot} aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {!isFromOnboarding ? (
                <EnvironmentNotice environment={displayEnvironment} />
              ) : null}

              {message ? (
                <p style={styles.message} role="status">
                  {message}
                </p>
              ) : null}
              <p style={styles.authNote}>
                {isFromOnboarding
                  ? "Googleなしでも、つづきのリンクでホーム画面アプリに引き継げます。"
                  : "Googleの画面が開きます。接続後、このアプリに戻ります。"}
              </p>

              <div style={styles.actions}>
                {isFromOnboarding ? (
                  <>
                    <AppButton
                      type="button"
                      onClick={() => {
                        void handleGoogleSignIn();
                      }}
                      variant="accent"
                      fullWidth
                      disabled={isStartingAuth || isCheckingAccount}
                    >
                      {isStartingAuth ? "Googleを開いています..." : "Googleでつづける"}
                    </AppButton>
                    <AppButton
                      type="button"
                      variant="quiet"
                      size="md"
                      onClick={handleLater}
                      fullWidth
                      disabled={isStartingAuth || isCheckingAccount}
                    >
                      {isStartingAuth ? "準備しています..." : "アプリでつづける"}
                    </AppButton>
                  </>
                ) : (
                  <>
                    <AppButton
                      type="button"
                      onClick={() => {
                        void handleGoogleSignIn();
                      }}
                      variant="primary"
                      fullWidth
                      disabled={isStartingAuth || isCheckingAccount}
                    >
                      {isStartingAuth ? "Googleを開いています..." : "Googleで続ける"}
                    </AppButton>
                    <AppButton
                      type="button"
                      onClick={handleLater}
                      variant="quiet"
                      size="md"
                      fullWidth
                    >
                      あとで
                    </AppButton>
                  </>
                )}
              </div>
            </>
          )}
        </AppCard>
      </div>
    </main>
  );
}

function loadGoogleIdentityScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("window is not available"));
      return;
    }

    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_ID_SCRIPT_SRC}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Identity script failed")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");

    script.src = GOOGLE_ID_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity script failed"));
    document.head.appendChild(script);
  });
}

function readOnboardingSourceFromLocation() {
  return normalizeOnboardingSource(
    new URLSearchParams(window.location.search).get("source"),
  );
}

function createAuthCallbackUrl({ nextPath }: { nextPath: string }) {
  const origin =
    typeof window === "undefined" ? "" : window.location.origin;
  const callbackUrl = new URL("/auth/callback", origin);

  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}

function EnvironmentNotice({
  environment,
}: {
  environment: DisplayEnvironment;
}) {
  const isStandalone = environment === "standalone";

  return (
    <div style={isStandalone ? styles.environmentNote : styles.environmentWarning}>
      <p style={styles.environmentTitle}>
        {getDisplayEnvironmentLabel(environment)}で開いています
      </p>
      <p style={styles.environmentText}>
        {isStandalone
          ? "この中の写真と記録をアカウントに保存できます。"
          : "ホーム画面アプリで撮った写真を保存したい場合は、ホーム画面のねてるねこから開いてください。"}
      </p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: APP_PAGE_BACKGROUND,
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: "#2a2a28",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "28px 16px 120px",
    boxSizing: "border-box",
  },
  wordmarkHeader: {
    marginBottom: "18px",
    paddingTop: "calc(10px + env(safe-area-inset-top))",
  },
  card: {
    padding: "24px 20px 22px",
    background: "rgba(255,253,248,0.62)",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: APP_ACCENT,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  title: {
    margin: "0 0 12px",
    color: "#2a2a28",
    fontSize: "20px",
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: "0.02em",
  },
  body: {
    margin: "0 0 20px",
    color: "#6a6a62",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.9,
    letterSpacing: 0,
    whiteSpace: "pre-line",
  },
  valueList: {
    display: "grid",
    gap: 0,
    margin: "0 0 18px",
    borderTop: "1px solid rgba(120,108,94,0.12)",
  },
  valueItem: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minHeight: "40px",
    borderBottom: "1px solid rgba(120,108,94,0.12)",
    color: "#3f433d",
    fontSize: "13px",
    fontWeight: 500,
    padding: "0 2px",
  },
  valueDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: APP_ACCENT,
    flexShrink: 0,
  },
  environmentNote: {
    margin: "0 0 16px",
    border: "1px solid rgba(169,149,126,0.26)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,253,248,0.62)",
    padding: "12px",
  },
  environmentWarning: {
    margin: "0 0 16px",
    border: "1px solid rgba(216,151,88,0.35)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,246,234,0.82)",
    padding: "12px",
  },
  environmentTitle: {
    margin: "0 0 4px",
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  environmentText: {
    margin: 0,
    color: "#7d766e",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.75,
  },
  message: {
    margin: "0 0 14px",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,253,248,0.68)",
    color: "#746a5f",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.75,
    padding: "11px 12px",
    boxShadow: "0 4px 12px rgba(90,76,60,0.025)",
  },
  authNote: {
    margin: "2px 0 16px",
    color: "#8a8a80",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.75,
  },
  connectedEmail: {
    margin: "0 0 18px",
    color: "#8a8a80",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.5,
    wordBreak: "break-all",
  },
  actions: {
    display: "grid",
    gap: "9px",
  },
  googleButtonMount: {
    minHeight: "46px",
    display: "grid",
    placeItems: "center",
    opacity: 0.94,
  },
} satisfies Record<string, CSSProperties>;
