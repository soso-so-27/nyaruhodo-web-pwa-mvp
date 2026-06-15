"use client";

import type { CSSProperties, ReactNode } from "react";
import { color, radius, spacing, typography } from "./designTokens";

type AppTagProps = {
  children: ReactNode;
  leading?: ReactNode;
  interactive?: boolean;
  style?: CSSProperties;
};

export function AppTag({ children, leading, interactive = false, style }: AppTagProps) {
  return (
    <span
      style={{
        ...styles.root,
        ...(interactive ? styles.interactive : {}),
        ...style,
      }}
    >
      {leading ? (
        <span style={styles.leading} aria-hidden="true">
          {leading}
        </span>
      ) : null}
      {children}
    </span>
  );
}

const styles = {
  root: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 32,
    border: `1px solid ${color.border}`,
    borderRadius: radius.pill,
    background: "color-mix(in srgb, var(--paper) 62%, transparent)",
    color: color.textMuted,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    fontWeight: 500,
    lineHeight: 1,
    padding: `0 ${spacing.md}px`,
    whiteSpace: "nowrap",
  },
  interactive: {
    cursor: "pointer",
  },
  leading: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
} satisfies Record<string, CSSProperties>;
