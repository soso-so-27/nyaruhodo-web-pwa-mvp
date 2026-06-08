"use client";

import type { CSSProperties, ReactNode } from "react";
import { color, spacing, typography } from "./designTokens";

type AppHeaderVariant = "wordmark" | "pageTitle";

type AppHeaderProps = {
  variant?: AppHeaderVariant;
  title?: string;
  right?: ReactNode;
  showWordmark?: boolean;
  style?: CSSProperties;
  className?: string;
};

export function AppHeader({
  variant = "wordmark",
  title = "ねてるねこ",
  right,
  showWordmark = true,
  style,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={className}
      style={{
        ...styles.header,
        ...(variant === "pageTitle" ? styles.pageTitleHeader : null),
        ...style,
      }}
    >
      {showWordmark ? (
        <h1 style={variant === "pageTitle" ? styles.pageTitle : styles.wordmark}>
          {title}
        </h1>
      ) : (
        <span aria-hidden="true" />
      )}
      {right ? <div style={styles.right}>{right}</div> : null}
    </header>
  );
}

export function WordmarkHeader(props: Omit<AppHeaderProps, "variant">) {
  return <AppHeader {...props} variant="wordmark" />;
}

const styles = {
  header: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    paddingTop: `calc(${spacing.sm}px + env(safe-area-inset-top))`,
    boxSizing: "border-box",
  },
  pageTitleHeader: {
    minHeight: 42,
  },
  wordmark: {
    margin: 0,
    color: color.textMuted,
    fontFamily: typography.fontSerif,
    fontSize: typography.brand.fontSize,
    fontWeight: typography.brand.fontWeight,
    lineHeight: typography.brand.lineHeight,
    letterSpacing: typography.brand.letterSpacing,
  },
  pageTitle: {
    margin: 0,
    color: color.textStrong,
    fontFamily: typography.fontSerif,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
    letterSpacing: "0.12em",
  },
  right: {
    position: "absolute",
    right: 0,
    top: "50%",
    transform: "translateY(-50%)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
} satisfies Record<string, CSSProperties>;
