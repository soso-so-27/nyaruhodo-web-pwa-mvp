"use client";

import type { CSSProperties, ReactNode } from "react";
import { color, spacing, typography } from "./designTokens";
import { AppCard } from "./AppCard";

type EmptyStateProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: "quiet" | "card";
  style?: CSSProperties;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = "quiet",
  style,
}: EmptyStateProps) {
  const content = (
    <div style={{ ...styles.root, ...style }}>
      {icon ? <span style={styles.icon}>{icon}</span> : null}
      {title ? <p style={styles.title}>{title}</p> : null}
      {description ? <p style={styles.description}>{description}</p> : null}
      {action ? <div style={styles.action}>{action}</div> : null}
    </div>
  );

  if (variant === "card") {
    return (
      <AppCard variant="outlined" padding="lg">
        {content}
      </AppCard>
    );
  }

  return content;
}

const styles = {
  root: {
    display: "grid",
    justifyItems: "center",
    gap: spacing.sm,
    textAlign: "center",
    color: color.textMuted,
  },
  icon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: "50%",
    color: color.textFaint,
    background: "color-mix(in srgb, var(--paper) 42%, transparent)",
    border: `1px solid ${color.border}`,
  },
  title: {
    margin: 0,
    color: color.text,
    fontSize: typography.body.fontSize,
    fontWeight: 500,
    lineHeight: 1.45,
  },
  description: {
    margin: 0,
    color: color.textMuted,
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    lineHeight: typography.caption.lineHeight,
  },
  action: {
    marginTop: spacing.sm,
  },
} satisfies Record<string, CSSProperties>;
