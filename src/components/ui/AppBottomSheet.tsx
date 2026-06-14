"use client";

import type { CSSProperties, ReactNode } from "react";
import { AppButton } from "./AppButton";
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
  variant = "paper",
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
          <AppButton
            type="button"
            onClick={onClose}
            variant="ghost"
            size="icon"
            iconOnly
            aria-label={closeLabel}
          >
            <CloseIcon size={18} />
          </AppButton>
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
    background: "color-mix(in srgb, var(--ink) 22%, transparent)",
    zIndex: 60,
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    willChange: "opacity",
  },
  backdropPaper: {
    position: "fixed",
    inset: 0,
    background: "color-mix(in srgb, var(--ink) 16%, transparent)",
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
    background: "color-mix(in srgb, var(--paper) 96%, transparent)",
    color: "var(--ink)",
    borderRadius: "24px 24px 0 0",
    border: "1px solid var(--line)",
    borderBottom: "none",
    boxShadow: "var(--shadow-e2)",
    backdropFilter: "blur(28px)",
    WebkitBackdropFilter: "blur(28px)",
    padding: "10px 16px calc(40px + env(safe-area-inset-bottom))",
    transformOrigin: "50% 100%",
    animation: "slideUp var(--dur-move) var(--ease-settle)",
    willChange: "transform, opacity",
  },
  sheetPaper: {
    background: "var(--paper)",
    color: "var(--ink)",
    border: "1px solid var(--line)",
    borderBottom: "none",
    boxShadow: "var(--shadow-e2)",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
  },
  handle: {
    width: "42px",
    height: "4px",
    borderRadius: "var(--radius-full)",
    background: "var(--line)",
    margin: "2px auto 14px",
  },
  handlePaper: {
    background: "var(--line)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 400,
    color: "var(--ink)",
    margin: 0,
    letterSpacing: 0,
  },
  titlePaper: {
    color: "var(--ink)",
  },
} satisfies Record<string, CSSProperties>;

