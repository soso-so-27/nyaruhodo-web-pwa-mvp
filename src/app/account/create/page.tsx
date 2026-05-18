"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createBrowserSupabaseClient } from "../../../lib/supabase/browser";
import { getSiteUrl } from "../../../lib/supabase/config";
import {
  APP_ACCENT,
  APP_ACCENT_SOFT_BG,
  APP_PAGE_BACKGROUND,
  APP_SUBTLE_SURFACE,
  APP_SURFACE,
} from "../../../components/ui/appTheme";

const ACCOUNT_CREATE_PROMPT_DISMISSED_KEY = "account_create_prompt_dismissed";
const ACCOUNT_CREATE_PROMPT_DISMISSED_MS = 7 * 24 * 60 * 60 * 1000;

export default function AccountCreatePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isStartingAuth, setIsStartingAuth] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);
  const [isAccountConnected, setIsAccountConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");

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

  async function handleGoogleSignIn() {
    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      setMessage("アカウント接続の準備がまだできていません。");
      return;
    }

    setIsStartingAuth(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getSiteUrl()}/auth/callback?next=/home`,
      },
    });

    if (error) {
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
              <h1 style={styles.title}>アカウントに接続済みです</h1>
              <p style={styles.body}>
                この端末の猫情報はそのまま使えます。
                次のステップで、この子の記録を引き継げるようにします。
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
              <p style={styles.eyebrow}>にゃるほどの保存</p>
              <h1 style={styles.title}>
                この子のことを、あとから見返せるように
              </h1>
              <p style={styles.body}>
                にゃるほどにアカウントを作ると、診断結果やプロフィールを残しておけます。
                今はこの端末に保存されていますが、アカウント作成後は引き継げるようにしていきます。
              </p>

              <div style={styles.valueList} aria-label="保存できるもの">
                {[
                  "タイプ診断の結果",
                  "猫のプロフィール",
                  "最近の様子",
                  "コレクション",
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
                  無料で保存する
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
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1.42,
    letterSpacing: 0,
  },
  body: {
    margin: "0 0 18px",
    color: "#6a6a62",
    fontSize: "14px",
    lineHeight: 1.8,
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
    fontSize: "13px",
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
    fontSize: "13px",
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
    fontSize: "15px",
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
