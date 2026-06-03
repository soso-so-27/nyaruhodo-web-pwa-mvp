"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  APP_ACCENT,
  APP_ACCENT_SOFT_BG,
  APP_PAGE_BACKGROUND,
  APP_SUBTLE_SURFACE,
  APP_SURFACE,
} from "../../../components/ui/appTheme";
import { STORAGE_KEYS } from "../../../lib/storage";
import { trackProductEvent } from "../../../lib/analytics/productAnalytics";
import { createBrowserSupabaseClient } from "../../../lib/supabase/browser";
import { getSiteUrl } from "../../../lib/supabase/config";

const ACCOUNT_CREATE_PROMPT_DISMISSED_KEY =
  STORAGE_KEYS.accountCreatePromptDismissed;
const ACCOUNT_CREATE_PROMPT_DISMISSED_MS = 7 * 24 * 60 * 60 * 1000;

export default function AccountCreatePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isStartingAuth, setIsStartingAuth] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);
  const [isAccountConnected, setIsAccountConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const hasTrackedCtaView = useRef(false);
  const hasTrackedCallbackError = useRef(false);

  useEffect(() => {
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
    trackProductEvent("account_create_cta_clicked", {
      route: "/account/create",
      trigger: "account_create_page",
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
    });
    window.localStorage.setItem(
      STORAGE_KEYS.authGooglePending,
      JSON.stringify({
        provider: "google",
        route: "/account/create",
        startedAt: new Date().toISOString(),
      }),
    );

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getSiteUrl()}/auth/callback?next=/home`,
      },
    });

    if (error) {
      window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
      trackProductEvent("auth_google_failed", {
        error_type: "oauth_start_failed",
      });
      setIsStartingAuth(false);
      setMessage(
        "Googleログインを開始できませんでした。少し時間をおいてもう一度お試しください。",
      );
    }
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

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.card}>
          {isAccountConnected ? (
            <>
              <p style={styles.eyebrow}>アカウント</p>
              <h1 style={styles.title}>Googleアカウントに接続済みです</h1>
              <p style={styles.body}>
                この端末のねがおを、アカウントに保存できます。
                別の端末でも復元できます。
              </p>
              {connectedEmail ? (
                <p style={styles.connectedEmail}>{connectedEmail}</p>
              ) : null}
              <div style={styles.actions}>
                <button
                  type="button"
                  onClick={() => router.push("/home")}
                  style={styles.primaryButton}
                >
                  ホームへ戻る
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={styles.eyebrow}>ねてるねこの保存</p>
              <h1 style={styles.title}>
                ねがおを、あとから見返せるように
              </h1>
              <p style={styles.body}>
                Googleアカウントで接続すると、この端末のねがおを保存できます。
                別の端末でも、とったねがおやとどいたねがおを復元できます。
              </p>

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

              {message ? (
                <p style={styles.message} role="status">
                  {message}
                </p>
              ) : null}

              <div style={styles.actions}>
                <button
                  type="button"
                  onClick={() => {
                    void handleGoogleSignIn();
                  }}
                  style={styles.primaryButton}
                  disabled={isStartingAuth || isCheckingAccount}
                >
                  Googleで保存する
                </button>
                <button
                  type="button"
                  onClick={handleLater}
                  style={styles.secondaryButton}
                >
                  あとで
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: APP_PAGE_BACKGROUND,
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
  card: {
    ...APP_SURFACE,
    borderRadius: "28px",
    padding: "24px 20px 20px",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: APP_ACCENT,
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.4,
  },
  title: {
    margin: "0 0 14px",
    color: "#2a2a28",
    fontSize: "23px",
    fontWeight: 680,
    lineHeight: 1.45,
    letterSpacing: 0,
  },
  body: {
    margin: "0 0 18px",
    color: "#6a6a62",
    fontSize: "15px",
    lineHeight: 1.75,
    letterSpacing: 0,
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
    borderRadius: "14px",
    color: "#3f433d",
    fontSize: "14px",
    fontWeight: 600,
    padding: "0 12px",
  },
  valueDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: APP_ACCENT,
    flexShrink: 0,
  },
  message: {
    margin: "0 0 14px",
    border: "1px solid rgba(200,197,190,0.9)",
    borderRadius: "14px",
    background: APP_ACCENT_SOFT_BG,
    color: APP_ACCENT,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.6,
    padding: "10px 12px",
  },
  connectedEmail: {
    margin: "0 0 18px",
    color: "#8a8a80",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.5,
    wordBreak: "break-all",
  },
  actions: {
    display: "grid",
    gap: "10px",
  },
  primaryButton: {
    width: "100%",
    minHeight: "52px",
    border: "none",
    borderRadius: "16px",
    background: APP_ACCENT,
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    minHeight: "46px",
    border: "none",
    borderRadius: "14px",
    background: "transparent",
    color: "#8a8a80",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
