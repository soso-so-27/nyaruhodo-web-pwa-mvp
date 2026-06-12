"use client";

import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  CSSProperties,
  ReactNode,
} from "react";
import { color, radius, shadow, spacing, typography } from "./designTokens";

type AppButtonVariant = "primary" | "accent" | "secondary" | "quiet" | "danger";
type AppButtonSize = "md" | "lg";

type AppButtonBaseProps = {
  children: ReactNode;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  style?: CSSProperties;
};

type AppButtonAsButtonProps = AppButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children"> & {
    href?: undefined;
  };

type AppButtonAsAnchorProps = AppButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "style" | "children"> & {
    href: string;
    disabled?: boolean;
  };

export type AppButtonProps = AppButtonAsButtonProps | AppButtonAsAnchorProps;

export function AppButton({
  children,
  variant = "primary",
  size = "lg",
  fullWidth = false,
  style,
  ...props
}: AppButtonProps) {
  const isDisabled = Boolean(props.disabled);
  const buttonStyle = {
    ...styles.base,
    ...styles[size],
    ...styles[variant],
    ...(fullWidth ? styles.fullWidth : null),
    ...(isDisabled ? styles.disabled : null),
    ...style,
  };

  if ("href" in props && props.href) {
    const { disabled: _disabled, ...anchorProps } =
      props as AppButtonAsAnchorProps;

    return (
      <a
        {...anchorProps}
        aria-disabled={isDisabled || anchorProps["aria-disabled"]}
        style={buttonStyle}
      >
        {children}
      </a>
    );
  }

  const buttonProps = props as AppButtonAsButtonProps;

  return (
    <button {...buttonProps} style={buttonStyle}>
      {children}
    </button>
  );
}

const styles = {
  base: {
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    fontFamily: typography.fontSerif,
    fontSize: typography.cta.fontSize,
    fontWeight: typography.cta.fontWeight,
    lineHeight: typography.cta.lineHeight,
    letterSpacing: "var(--tracking-label)",
    textDecoration: "none",
    whiteSpace: "nowrap",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  md: {
    minHeight: 42,
    padding: `0 ${spacing.lg + 2}px`,
  },
  lg: {
    minHeight: 54,
    padding: `0 ${spacing.xl}px`,
  },
  fullWidth: {
    width: "100%",
  },
  primary: {
    border: `1px solid ${color.border}`,
    background: "color-mix(in srgb, var(--paper) 92%, transparent)",
    color: color.textStrong,
    boxShadow: shadow.soft,
  },
  accent: {
    border: `1px solid ${color.border}`,
    background: "color-mix(in srgb, var(--paper-card) 96%, transparent)",
    color: color.text,
    boxShadow: shadow.soft,
  },
  secondary: {
    border: `1px solid ${color.border}`,
    background: "color-mix(in srgb, var(--paper) 78%, transparent)",
    color: color.textMuted,
    boxShadow: shadow.soft,
  },
  quiet: {
    border: "1px solid transparent",
    background: "transparent",
    color: color.textFaint,
    boxShadow: shadow.none,
  },
  danger: {
    border: `1px solid ${color.border}`,
    background: "transparent",
    color: color.danger,
    boxShadow: shadow.none,
  },
  disabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
} satisfies Record<string, CSSProperties>;
