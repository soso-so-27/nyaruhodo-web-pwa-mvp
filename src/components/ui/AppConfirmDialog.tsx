"use client";

import { useId, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AppButton } from "./AppButton";
import { useModalBehavior } from "./useModalBehavior";

type AppConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  confirmVariant?: "primary" | "secondary" | "danger";
};

export function AppConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel = "キャンセル",
  confirmVariant = "danger",
}: AppConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const { modalRef, handleModalKeyDown } = useModalBehavior<HTMLElement>({
    open,
    onClose: onCancel,
  });

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      style={styles.backdrop}
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) {
          onCancel();
        }
      }}
    >
      <section
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        style={styles.dialog}
        onKeyDown={handleModalKeyDown}
      >
        <h2 id={titleId} style={styles.title}>
          {title}
        </h2>
        <p id={descriptionId} style={styles.description}>
          {description}
        </p>
        <div style={styles.actions}>
          <AppButton type="button" variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </AppButton>
          <AppButton
            type="button"
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </AppButton>
        </div>
      </section>
    </div>,
    document.body,
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    display: "grid",
    placeItems: "center",
    padding:
      "calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom))",
    background: "color-mix(in srgb, var(--ink) 18%, transparent)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },
  dialog: {
    width: "min(100%, 360px)",
    display: "grid",
    gap: "13px",
    padding: "20px",
    border: "1px solid color-mix(in srgb, var(--line) 72%, transparent)",
    borderRadius: "var(--radius-xl)",
    background: "var(--paper-card)",
    boxShadow: "var(--shadow-e2)",
    outline: "none",
  },
  title: {
    margin: 0,
    color: "var(--ink)",
    fontFamily: "var(--font-ui)",
    fontSize: "17px",
    fontWeight: 500,
    lineHeight: 1.45,
  },
  description: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-ui)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.6,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginTop: "3px",
  },
} satisfies Record<string, CSSProperties>;
