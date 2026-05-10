"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";

const ACCOUNT_CREATE_PROMPT_DISMISSED_KEY = "account_create_prompt_dismissed";
const ACCOUNT_CREATE_PROMPT_DISMISSED_MS = 7 * 24 * 60 * 60 * 1000;

export default function AccountCreatePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");

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
          <p style={styles.eyebrow}>にゃるほどの保存</p>
          <h1 style={styles.title}>
            この子のことを、あとから見返せるように
          </h1>
          <p style={styles.body}>
            にゃるほどにアカウントを作ると、診断結果やプロフィールを残しておけます。
            今はこの端末に保存されていますが、アカウント作成後は引き継げるようにしていきます。
          </p>

          <div style={styles.valueList} aria-label="保存できるもの">
            {["タイプ診断の結果", "猫のプロフィール", "最近の様子", "コレクション"].map(
              (item) => (
                <div key={item} style={styles.valueItem}>
                  <span style={styles.valueDot} aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ),
            )}
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
                setMessage("アカウント作成は次のステップで対応します。");
              }}
              style={styles.primaryButton}
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
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
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
    background: "#ffffff",
    border: "1px solid rgba(219, 216, 207, 0.72)",
    borderRadius: "28px",
    padding: "24px 20px 20px",
    boxShadow: "0 12px 28px rgba(44, 42, 38, 0.04)",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#6B9E82",
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
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minHeight: "38px",
    border: "1px solid rgba(232, 229, 222, 0.86)",
    borderRadius: "14px",
    background: "#fbfaf7",
    color: "#3f433d",
    fontSize: "13px",
    fontWeight: 600,
    padding: "0 12px",
  },
  valueDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#6B9E82",
    flexShrink: 0,
  },
  message: {
    margin: "0 0 14px",
    border: "1px solid rgba(107, 158, 130, 0.24)",
    borderRadius: "14px",
    background: "rgba(107, 158, 130, 0.08)",
    color: "#3d6650",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.6,
    padding: "10px 12px",
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
    background: "#6B9E82",
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
