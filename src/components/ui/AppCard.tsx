"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { color, radius, shadow, spacing } from "./designTokens";

type AppCardVariant = "section" | "outlined" | "inset" | "floating";
type AppCardPadding = "none" | "sm" | "md" | "standard" | "lg" | "xl";
type AppCardElement = "section" | "article" | "div" | "button";

type AppCardProps = {
  as?: AppCardElement;
  variant?: AppCardVariant;
  padding?: AppCardPadding;
  interactive?: boolean;
  children: ReactNode;
  /**
   * Escape hatch for layout-only adjustments. Avoid overriding background,
   * border, radius, or shadow here; use a variant instead so card hierarchy
   * stays line-or-shadow exclusive.
   */
  style?: CSSProperties;
  className?: string;
  type?: "button" | "submit" | "reset";
} & Omit<HTMLAttributes<HTMLElement>, "children" | "style" | "className" | "type">;

export function AppCard({
  as: Element = "section",
  variant = "section",
  padding = "standard",
  interactive = false,
  children,
  style,
  className,
  ...props
}: AppCardProps) {
  return (
    <Element
      {...props}
      className={className}
      style={{
        ...styles.base,
        ...styles[variant],
        ...paddingStyles[padding],
        ...(interactive ? styles.interactive : {}),
        ...style,
      }}
    >
      {children}
    </Element>
  );
}

export function AppSurface(props: AppCardProps) {
  return <AppCard {...props} />;
}

const styles = {
  base: {
    boxSizing: "border-box",
    borderRadius: radius.card,
    border: "none",
    boxShadow: shadow.none,
  },
  /**
   * Card hierarchy:
   * - outer section cards use shadow only.
   * - inner inset cards use a hairline only.
   * - outlined cards use a hairline only.
   * - floating cards use strong shadow only.
   *
   * Do not combine border and shadow in a variant.
   */
  section: {
    background: color.surfaceSoft,
    boxShadow: shadow.card,
  },
  outlined: {
    background: color.surfaceSoft,
    border: `1px solid ${color.border}`,
    boxShadow: shadow.none,
  },
  inset: {
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.none,
  },
  floating: {
    background: color.surfaceSoft,
    borderRadius: radius.xxl24,
    boxShadow: shadow.floating,
  },
  interactive: {
    cursor: "pointer",
    transition:
      "transform var(--dur-instant) var(--ease-settle), box-shadow var(--dur-instant) var(--ease-gentle)",
    WebkitTapHighlightColor: "transparent",
  },
} satisfies Record<string, CSSProperties>;

const paddingStyles = {
  none: {
    padding: 0,
  },
  sm: {
    padding: spacing.md,
  },
  md: {
    padding: spacing.lg,
  },
  standard: {
    padding: 20,
  },
  lg: {
    padding: spacing.xl,
  },
  xl: {
    padding: spacing.xxl,
  },
} satisfies Record<string, CSSProperties>;
