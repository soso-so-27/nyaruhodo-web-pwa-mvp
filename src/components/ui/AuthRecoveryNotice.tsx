"use client";

import type { CSSProperties } from "react";
import { buildLoginRecoveryHref } from "../../lib/auth/sessionRecovery";
import { AppButton } from "./AppButton";

export function AuthRecoveryNotice({
  returnTo,
  message = "ログインの有効期限が切れた可能性があります。もう一度ログインすると、この画面へ戻ります。",
}: {
  returnTo: string;
  message?: string;
}) {
  return (
    <div style={styles.root} role="status" data-testid="auth-recovery-notice">
      <div style={styles.copy}>
        <p style={styles.title}>ログインをもう一度確認してください</p>
        <p style={styles.description}>{message}</p>
        <p style={styles.safety}>この端末に保存済みの写真と記録は、そのまま残ります。</p>
      </div>
      <AppButton
        href={buildLoginRecoveryHref(returnTo)}
        variant="secondary"
        size="md"
        fullWidth
      >
        Googleでログインし直す
      </AppButton>
    </div>
  );
}

const styles = {
  root: {
    display: "grid",
    gap: "12px",
    paddingTop: "14px",
    borderTop: "1px solid var(--line)",
  },
  copy: {
    display: "grid",
    gap: "5px",
  },
  title: {
    margin: 0,
    color: "var(--ink)",
    fontFamily: "var(--font-ui)",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.55,
  },
  description: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-ui)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.7,
  },
  safety: {
    margin: 0,
    color: "var(--ink-faint)",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.65,
  },
} satisfies Record<string, CSSProperties>;
