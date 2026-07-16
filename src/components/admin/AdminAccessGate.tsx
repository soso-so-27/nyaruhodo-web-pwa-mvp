"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { readClientAdminCapabilities } from "../../lib/adminCapabilitiesClient";

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
        このGoogleアカウントでは管理画面を開けません。管理者として登録したアカウントでログインしてから、もう一度開いてください。
      </AdminState>
    );
  }

  return <>{children}</>;
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
        <p style={{ margin: 0, color: "#6f6258" }}>{children}</p>
      </section>
    </main>
  );
}
