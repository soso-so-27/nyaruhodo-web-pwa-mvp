"use client";

import type { CSSProperties } from "react";
import { color, radius, spacing, typography } from "./designTokens";

type AppToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  showStateText?: boolean;
  style?: CSSProperties;
};

export function AppToggle({
  checked,
  onChange,
  disabled = false,
  label,
  showStateText = true,
  style,
}: AppToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-app-pressable="toggle"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        ...styles.root,
        ...(checked ? styles.rootChecked : {}),
        ...(disabled ? styles.rootDisabled : {}),
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          ...styles.knob,
          transform: checked ? "translateX(24px)" : "translateX(0)",
        }}
      />
      {showStateText ? (
        <span
          style={{
            ...styles.text,
            color: checked ? color.paper : color.textMuted,
          }}
        >
          {checked ? "ON" : "OFF"}
        </span>
      ) : null}
    </button>
  );
}

const styles = {
  root: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 68,
    minHeight: 44,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    borderRadius: radius.pill,
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    color: color.textMuted,
    cursor: "pointer",
    padding: `0 ${spacing.sm}px 0 34px`,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    fontWeight: 500,
    lineHeight: 1,
    transition:
      "transform var(--app-press-duration, var(--dur-press-out)) var(--ease-settle), background var(--dur-instant) var(--ease-gentle), color var(--dur-instant) var(--ease-gentle), border-color var(--dur-instant) var(--ease-gentle), opacity var(--app-press-duration, var(--dur-press-out)) var(--ease-gentle)",
  },
  rootChecked: {
    background: color.text,
    borderColor: color.text,
    color: color.paper,
  },
  rootDisabled: {
    cursor: "not-allowed",
    opacity: 0.55,
  },
  knob: {
    position: "absolute",
    left: 7,
    top: "50%",
    width: 24,
    height: 24,
    borderRadius: radius.circle,
    background: color.paper,
    boxShadow: "var(--shadow-e0)",
    transform: "translateX(0)",
    translate: "0 -50%",
    transition: "transform var(--dur-instant) var(--ease-gentle)",
  },
  text: {
    position: "relative",
    zIndex: 1,
    minWidth: 24,
    textAlign: "center",
  },
} satisfies Record<string, CSSProperties>;
