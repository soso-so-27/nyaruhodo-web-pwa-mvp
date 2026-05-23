"use client";

import type { CSSProperties, ReactNode } from "react";
import { CloseIcon } from "./AppIcons";

type AppBottomSheetProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
};

export function AppBottomSheet({
  title,
  children,
  onClose,
  closeLabel = "閉じる",
}: AppBottomSheetProps) {
  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <section style={styles.sheet} role="dialog" aria-modal="true">
        <div style={styles.handle} aria-hidden="true" />
        <div style={styles.header}>
          <p style={styles.title}>{title}</p>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label={closeLabel}
          >
            <CloseIcon size={18} />
          </button>
        </div>
        {children}
      </section>
    </>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.34)",
    zIndex: 60,
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
  },
  sheet: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 61,
    background: "rgba(30,26,24,0.82)",
    color: "rgba(255,255,255,0.94)",
    borderRadius: "24px 24px 0 0",
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderBottom: "none",
    boxShadow: "0 -18px 44px rgba(0,0,0,0.28)",
    backdropFilter: "blur(28px)",
    WebkitBackdropFilter: "blur(28px)",
    padding: "10px 16px calc(40px + env(safe-area-inset-bottom))",
    animation: "slideUp 0.22s ease-out",
  },
  handle: {
    width: "42px",
    height: "4px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.38)",
    margin: "2px auto 14px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  },
  title: {
    fontSize: "16px",
    fontWeight: 650,
    color: "rgba(255,255,255,0.95)",
    margin: 0,
    letterSpacing: 0,
  },
  closeButton: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "0.5px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.86)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
} satisfies Record<string, CSSProperties>;

