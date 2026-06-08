"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { color, radius, shadow, spacing } from "./designTokens";

type AppCardVariant = "paper" | "soft" | "floating" | "outlined";
type AppCardPadding = "sm" | "md" | "lg" | "xl";

type AppCardProps = {
  variant?: AppCardVariant;
  padding?: AppCardPadding;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "style" | "className">;

export function AppCard({
  variant = "paper",
  padding = "lg",
  children,
  style,
  className,
  ...props
}: AppCardProps) {
  return (
    <section
      {...props}
      className={className}
      style={{
        ...styles.base,
        ...styles[variant],
        ...paddingStyles[padding],
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function AppSurface(props: AppCardProps) {
  return <AppCard {...props} />;
}

const styles = {
  base: {
    boxSizing: "border-box",
    borderRadius: radius.card,
    border: `1px solid ${color.border}`,
  },
  paper: {
    background: color.paper,
    boxShadow: shadow.card,
  },
  soft: {
    background: color.surface,
    boxShadow: shadow.soft,
  },
  floating: {
    background: color.surface,
    boxShadow: shadow.floating,
  },
  outlined: {
    background: color.surfaceSoft,
    boxShadow: shadow.none,
  },
} satisfies Record<string, CSSProperties>;

const paddingStyles = {
  sm: {
    padding: spacing.md,
  },
  md: {
    padding: spacing.lg,
  },
  lg: {
    padding: spacing.xl,
  },
  xl: {
    padding: spacing.xxl,
  },
} satisfies Record<string, CSSProperties>;
