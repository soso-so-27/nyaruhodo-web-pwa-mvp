"use client";

import type { CSSProperties, ReactNode } from "react";
import { CloseIcon } from "./AppIcons";

type AppBottomSheetProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  variant?: "dark" | "paper";
};

export function AppBottomSheet({
  title,
  children,
  onClose,
  closeLabel = "閉じる",
  variant = "dark",
}: AppBottomSheetProps) {
  const isPaper = variant === "paper";

  return (
    <>
      <div
        style={isPaper ? styles.backdropPaper : styles.backdrop}
        onClick={onClose}
      />
      <section
        style={isPaper ? { ...styles.sheet, ...styles.sheetPaper } : styles.sheet}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={isPaper ? { ...styles.handle, ...styles.handlePaper } : styles.handle}
          aria-hidden="true"
        />
        <div style={styles.header}>
          <p style={isPaper ? { ...styles.title, ...styles.titlePaper } : styles.title}>
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            style={
              isPaper
                ? { ...styles.closeButton, ...styles.closeButtonPaper }
                : styles.closeButton
            }
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
    willChange: "opacity",
  },
  backdropPaper: {
    position: "fixed",
    inset: 0,
    background: "rgba(47,42,35,0.22)",
    zIndex: 60,
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    willChange: "opacity",
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
    transformOrigin: "50% 100%",
    animation: "slideUp 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)",
    willChange: "transform, opacity",
  },
  sheetPaper: {
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.98), rgba(246,239,228,0.98))",
    color: "#332c26",
    border: "0.5px solid rgba(120,108,94,0.18)",
    borderBottom: "none",
    boxShadow: "0 -18px 44px rgba(90,76,60,0.16)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  },
  handle: {
    width: "42px",
    height: "4px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.38)",
    margin: "2px auto 14px",
  },
  handlePaper: {
    background: "rgba(120,108,94,0.28)",
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
  titlePaper: {
    color: "#332c26",
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
  closeButtonPaper: {
    border: "0.5px solid rgba(120,108,94,0.16)",
    background: "rgba(255,255,255,0.52)",
    color: "#746a5f",
  },
} satisfies Record<string, CSSProperties>;

