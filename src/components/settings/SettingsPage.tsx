"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";

export function SettingsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    void checkAuthState();
  }, []);

  async function checkAuthState() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    setIsLoggedIn(Boolean(data.user));
    setEmail(data.user?.email ?? null);
    setIsLoading(false);
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setEmail(null);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <a href="/home" style={styles.backButton}>
            <span style={styles.backIcon}>‹</span>
          </a>
          <h1 style={styles.title}>設定</h1>
        </div>

        <section style={styles.section}>
          <p style={styles.sectionLabel}>アカウント</p>
          <div style={styles.card}>
            {isLoading ? (
              <p style={styles.loadingText}>確認中...</p>
            ) : isLoggedIn ? (
              <>
                <div style={styles.row}>
                  <div style={styles.rowLeft}>
                    <span style={styles.statusDot} />
                    <span style={styles.rowLabel}>接続済み</span>
                  </div>
                  <span style={styles.rowValue}>{email ?? ""}</span>
                </div>
                <div style={styles.divider} />
                <button
                  type="button"
                  onClick={handleLogout}
                  style={styles.dangerButton}
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <div style={styles.row}>
                  <div style={styles.rowLeft}>
                    <span style={{ ...styles.statusDot, ...styles.statusDotOff }} />
                    <span style={styles.rowLabel}>未接続</span>
                  </div>
                </div>
                <div style={styles.divider} />
                <a href="/account/create" style={styles.primaryButton}>
                  アカウントを作成する
                </a>
              </>
            )}
          </div>
        </section>

        <section style={styles.section}>
          <p style={styles.sectionLabel}>データ</p>
          <div style={styles.card}>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "すべてのデータを削除しますか？この操作は元に戻せません。",
                  )
                ) {
                  localStorage.clear();
                  window.location.href = "/";
                }
              }}
              style={styles.dangerButton}
            >
              データをすべて削除する
            </button>
          </div>
        </section>

        <section style={styles.section}>
          <p style={styles.sectionLabel}>このアプリについて</p>
          <div style={styles.card}>
            <div style={styles.row}>
              <span style={styles.rowLabel}>バージョン</span>
              <span style={styles.rowValue}>1.0.0</span>
            </div>
            <div style={styles.divider} />
            <div style={styles.row}>
              <span style={styles.rowLabel}>にゃるほど</span>
              <span style={styles.rowValue}>猫と話せない人のためのアプリ</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
    color: "#242522",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "0 16px 40px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 0 20px",
  },
  backButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.8)",
    border: "0.5px solid #e0ddd6",
    textDecoration: "none",
    color: "#2a2a28",
    flexShrink: 0,
  },
  backIcon: {
    fontSize: "20px",
    lineHeight: 1,
    color: "#2a2a28",
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#2a2a28",
    margin: 0,
  },
  section: {
    marginBottom: "20px",
  },
  sectionLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#9a9890",
    margin: "0 0 8px 4px",
    letterSpacing: "0.04em",
  },
  card: {
    background: "#ffffff",
    border: "0.5px solid #e5e2dc",
    borderRadius: "20px",
    padding: "4px 16px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 0",
  },
  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  rowLabel: {
    fontSize: "14px",
    color: "#2a2a28",
    fontWeight: 500,
  },
  rowValue: {
    fontSize: "13px",
    color: "#9a9890",
    maxWidth: "160px",
    textAlign: "right" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#6B9E82",
    flexShrink: 0,
  },
  statusDotOff: {
    background: "#d0cdc6",
  },
  divider: {
    height: "0.5px",
    background: "#f0ede8",
    margin: "0 -16px",
  },
  loadingText: {
    fontSize: "13px",
    color: "#9a9890",
    padding: "14px 0",
    margin: 0,
  },
  primaryButton: {
    display: "block",
    textAlign: "center" as const,
    padding: "14px 0",
    fontSize: "14px",
    fontWeight: 600,
    color: "#6B9E82",
    textDecoration: "none",
    cursor: "pointer",
  },
  dangerButton: {
    display: "block",
    width: "100%",
    padding: "14px 0",
    fontSize: "14px",
    fontWeight: 600,
    color: "#d85a30",
    background: "transparent",
    border: "none",
    textAlign: "center" as const,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
