"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AppLoadingScreen } from "../../../components/loading/AppLoadingScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { AppCard } from "../../../components/ui/AppCard";
import { WordmarkHeader } from "../../../components/ui/AppHeader";
import {
  APP_ACCENT,
  APP_PAGE_BACKGROUND,
  APP_SUBTLE_SURFACE,
} from "../../../components/ui/appTheme";
import { STORAGE_KEYS } from "../../../lib/storage";
import { trackProductEvent } from "../../../lib/analytics/productAnalytics";
import { writeAuthDebugEvent } from "../../../lib/authDebug";
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
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const hasTrackedCtaView = useRef(false);
  const hasTrackedCallbackError = useRef(false);

  function markOnboardingAlbumCompletionReady() {
    window.sessionStorage.setItem(ONBOARDING_ALBUM_COMPLETION_READY_KEY, "true");
  }
  const hasInitializedGoogleButton = useRef(false);

  useEffect(() => {
    setDisplayEnvironment(getDisplayEnvironment());
    const fromOnboarding =
      new URLSearchParams(window.location.search).get("from") === "onboarding";

    setIsFromOnboarding(fromOnboarding);

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

  useEffect(() => {
    if (isCheckingAccount || isAccountConnected) {
      return;
    }

    const fromOnboarding =
      new URLSearchParams(window.location.search).get("from") === "onboarding";

    if (!GOOGLE_CLIENT_ID) {
      if (!fromOnboarding) {
        setMessage("Googleログインを準備できませんでした。少し時間をおいてもう一度お試しください。");
      }
      return;
    }

    let isCancelled = false;

    async function setupGoogleButton() {
      try {
        await loadGoogleIdentityScript();

        if (
          isCancelled ||
          hasInitializedGoogleButton.current ||
          !googleButtonRef.current ||
          !window.google?.accounts?.id
        ) {
          return;
        }

        hasInitializedGoogleButton.current = true;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            void handleGoogleCredential(response);
          },
          use_fedcm_for_prompt: true,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 320,
          locale: "ja",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Google script load failed";

        writeAuthDebugEvent("gis_script_failed", { message });
        setMessage("Googleログインの読み込みに失敗しました。もう一度お試しください。");
      }
    }

    void setupGoogleButton();

    return () => {
      isCancelled = true;
    };
  }, [isAccountConnected, isCheckingAccount]);

  async function handleGoogleSignIn() {
    if (!GOOGLE_CLIENT_ID) {
      if (!isFromOnboarding) {
        setMessage("Googleログインを準備できませんでした。少し時間をおいてもう一度お試しください。");
      }
      return;
    }

    try {
      await loadGoogleIdentityScript();

      if (!window.google?.accounts?.id) {
        setMessage("Googleログインを読み込めませんでした。もう一度お試しください。");
        return;
      }

      if (!hasInitializedGoogleButton.current) {
        hasInitializedGoogleButton.current = true;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            void handleGoogleCredential(response);
          },
          use_fedcm_for_prompt: true,
        });
      }

      window.google.accounts.id.prompt();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google script load failed";

      writeAuthDebugEvent("gis_prompt_failed", { message });
      setMessage("Googleログインの読み込みに失敗しました。もう一度お試しください。");
    }
  }

  async function handleGoogleCredential(response: GoogleCredentialResponse) {
    trackProductEvent("account_create_cta_clicked", {
      route: "/account/create",
      trigger: "google_identity_button",
    });

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
    }
    await claimPendingReferral();
    router.replace(
      isFromOnboarding ? "/cats?onboarding=1" : "/home?auth=google_success",
    );
  }

  function handleLater() {
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
                  ? "このねこのアルバムをつくる"
                  : "Googleアカウントに接続済みです"}
              </h1>
              <p style={styles.body}>
                {isFromOnboarding
                  ? "今日の2枚を\nあとから見返せるようにします。"
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
                {isFromOnboarding ? "とっておいた2枚" : "ねてるねこの保存"}
              </p>
              <h1 style={styles.title}>
                {isFromOnboarding
                  ? "このねこのアルバムをつくる"
                  : "ねがおを、あとから見返せるように"}
              </h1>
              <p style={styles.body}>
                {isFromOnboarding
                  ? "今日の2枚を\nあとから見返せるようにします。"
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
                  ? "名前や場所は公開されません。"
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
                    >
                      あとで
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
    padding: "26px 22px 22px",
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
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: 0,
  },
  body: {
    margin: "0 0 20px",
    color: "#6a6a62",
    fontSize: "15px",
    lineHeight: 1.75,
    letterSpacing: 0,
    whiteSpace: "pre-line",
  },
  valueList: {
    display: "grid",
    gap: "8px",
    margin: "0 0 18px",
  },
  valueItem: {
    ...APP_SUBTLE_SURFACE,
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minHeight: "38px",
    borderRadius: "var(--radius-md)",
    color: "#3f433d",
    fontSize: "13px",
    fontWeight: 500,
    padding: "0 12px",
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
    lineHeight: 1.6,
  },
  message: {
    margin: "0 0 14px",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,253,248,0.68)",
    color: "#746a5f",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.6,
    padding: "11px 12px",
    boxShadow: "0 4px 12px rgba(90,76,60,0.025)",
  },
  authNote: {
    margin: "2px 0 16px",
    color: "#8a8a80",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.6,
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
