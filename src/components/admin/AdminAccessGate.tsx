"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { readClientAdminCapabilities } from "../../lib/adminCapabilitiesClient";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";

type AdminAccessGateProps = {
  children: ReactNode;
  title: string;
};

/**
 * Browser auth is intentionally stored in localStorage, so Server Components
 * cannot use cookies to decide whether the current Google session is admin.
 * Protected APIs still enforce the same check using the bearer token.
 */
export function AdminAccessGate({ children, title }: AdminAccessGateProps) {
  const [state, setState] = useState<"checking" | "allowed" | "denied">(
    "checking",
  );
  const [loginState, setLoginState] = useState<"idle" | "starting">("idle");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    let active = true;

    void readClientAdminCapabilities().then((capabilities) => {
      if (active) {
        setState(capabilities.isAdmin ? "allowed" : "denied");
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (state === "checking") {
    return <AdminState title={title}>ログイン状態を確認しています。</AdminState>;
  }

  if (state === "denied") {
    return (
      <AdminState title={title}>
        <p style={{ margin: 0 }}>
          管理者として登録したGoogleアカウントでログインしてください。このブラウザでは、次回からそのまま開けます。
        </p>
        <button
          type="button"
          onClick={() => void handleAdminLogin()}
          disabled={loginState === "starting"}
          style={{
            minHeight: 44,
            marginTop: 20,
            padding: "10px 18px",
            border: "1px solid rgba(166, 80, 69, 0.4)",
            borderRadius: 8,
            background: "#fffdf9",
            color: "#7f3f37",
            font: "inherit",
            cursor: loginState === "starting" ? "wait" : "pointer",
          }}
        >
          {loginState === "starting" ? "Googleを開いています…" : "管理者でログイン"}
        </button>
        {loginError ? (
          <p role="alert" style={{ margin: "12px 0 0", color: "#a65045" }}>
            {loginError}
          </p>
        ) : null}
      </AdminState>
    );
  }

  return <>{children}</>;

  async function handleAdminLogin() {
    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      setLoginError("Googleログインの準備を読み込めませんでした。");
      return;
    }

    setLoginState("starting");
    setLoginError("");

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("error");
    const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", nextPath);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setLoginState("idle");
      setLoginError("Googleログインを開始できませんでした。もう一度お試しください。");
    }
  }
}

function AdminState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 20px",
        color: "#322b25",
        fontFamily: "var(--font-zen-kaku), system-ui, sans-serif",
      }}
    >
      <section style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ margin: 0, color: "#a65045", fontSize: 13 }}>管理画面</p>
        <h1 style={{ margin: "8px 0 12px", fontSize: 32, fontWeight: 500 }}>
          {title}
        </h1>
        <div style={{ color: "#6f6258", lineHeight: 1.7 }}>{children}</div>
      </section>
    </main>
  );
}
