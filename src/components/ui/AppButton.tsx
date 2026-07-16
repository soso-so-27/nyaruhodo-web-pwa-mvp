"use client";

import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  CSSProperties,
  MouseEvent,
  ReactNode,
} from "react";
import { color, radius, shadow, spacing, typography } from "./designTokens";

type AppButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "quiet"
  | "ghost"
  | "danger";
type AppButtonSize = "sm" | "md" | "lg" | "icon";
type AppButtonShape = "pill" | "square";

type AppButtonCommonProps = {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  shape?: AppButtonShape;
  fullWidth?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  pressed?: boolean;
  selected?: boolean;
  style?: CSSProperties;
};

type AppButtonContentProps =
  | {
      children: ReactNode;
      iconOnly?: false;
      "aria-label"?: string;
    }
  | {
      children?: ReactNode;
      iconOnly: true;
      "aria-label": string;
    };

type AppButtonBaseProps = AppButtonCommonProps & AppButtonContentProps;

type AppButtonAsButtonProps = AppButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children" | "aria-label"> & {
    href?: undefined;
  };

type AppButtonAsAnchorProps = AppButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "style" | "children" | "aria-label"> & {
    href: string;
    disabled?: boolean;
  };

export type AppButtonProps = AppButtonAsButtonProps | AppButtonAsAnchorProps;

export function AppButton({
  children,
  variant = "primary",
  size = "lg",
  shape = "pill",
  fullWidth = false,
  iconStart,
  iconEnd,
  iconOnly = false,
  loading = false,
  loadingLabel,
  pressed,
  selected = false,
  style,
  ...props
}: AppButtonProps) {
  const isDisabled = Boolean(props.disabled || loading);
  const buttonStyle = {
    ...styles.base,
    ...styles[size],
    ...styles[shape],
    ...styles[variant],
    ...(iconOnly ? styles.iconOnly : null),
    ...(fullWidth ? styles.fullWidth : null),
    ...(selected || pressed ? styles.active : null),
    ...(isDisabled ? styles.disabled : null),
    ...style,
  };
  const content = (
    <>
      {iconOnly ? (
        loading ? (
          <span style={styles.spinner} aria-hidden="true" />
        ) : (
          iconStart || children
        )
      ) : (
        <>
          {loading ? <span style={styles.spinner} aria-hidden="true" /> : iconStart}
          <span>{loading ? loadingLabel || children : children}</span>
          {!loading ? iconEnd : null}
        </>
      )}
    </>
  );

  if ("href" in props && props.href) {
    const { disabled: _disabled, onClick, ...anchorProps } =
      props as AppButtonAsAnchorProps;
    const handleAnchorClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (isDisabled) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    };

    return (
      <a
        {...anchorProps}
        aria-disabled={isDisabled || anchorProps["aria-disabled"]}
        aria-busy={loading || anchorProps["aria-busy"]}
        aria-pressed={pressed ?? anchorProps["aria-pressed"]}
        data-app-pressable={size === "icon" || iconOnly ? "icon" : "button"}
        data-selected={selected || undefined}
        onClick={handleAnchorClick}
        style={buttonStyle}
      >
        {content}
      </a>
    );
  }

  const buttonProps = props as AppButtonAsButtonProps;

  return (
    <button
      {...buttonProps}
      aria-busy={loading || buttonProps["aria-busy"]}
      aria-pressed={pressed ?? buttonProps["aria-pressed"]}
      data-app-pressable={size === "icon" || iconOnly ? "icon" : "button"}
      data-selected={selected || undefined}
      disabled={isDisabled || buttonProps.disabled}
      style={buttonStyle}
    >
      {content}
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
    fontFamily: typography.fontUi,
    fontSize: typography.cta.fontSize,
    fontWeight: typography.cta.fontWeight,
    lineHeight: typography.cta.lineHeight,
    letterSpacing: "0.04em",
    textDecoration: "none",
    whiteSpace: "nowrap",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition:
      "transform var(--app-press-duration, var(--dur-press-out)) var(--ease-settle), box-shadow var(--app-press-duration, var(--dur-press-out)) var(--ease-gentle), background var(--dur-instant) var(--ease-gentle), border-color var(--dur-instant) var(--ease-gentle), color var(--dur-instant) var(--ease-gentle), opacity var(--app-press-duration, var(--dur-press-out)) var(--ease-gentle)",
  },
  pill: {
    borderRadius: radius.pill,
  },
  square: {
    borderRadius: radius.md,
  },
  sm: {
    minHeight: 44,
    padding: `0 ${spacing.md}px`,
    fontSize: 13,
  },
  md: {
    minHeight: 44,
    padding: `0 ${spacing.lg}px`,
  },
  lg: {
    minHeight: 54,
    padding: `0 ${spacing.xl}px`,
  },
  icon: {
    width: 44,
    minWidth: 44,
    height: 44,
    minHeight: 44,
    padding: 0,
  },
  iconOnly: {
    gap: 0,
  },
  fullWidth: {
    width: "100%",
  },
  primary: {
    border: "1px solid var(--control-border)",
    background: "var(--control-surface)",
    color: color.textStrong,
    boxShadow: "var(--app-press-shadow, var(--shadow-e1))",
  },
  accent: {
    border: "1px solid var(--control-border)",
    background: "color-mix(in srgb, var(--paper-card) 96%, transparent)",
    color: color.text,
    boxShadow: "var(--app-press-shadow, var(--shadow-e1))",
  },
  secondary: {
    border: "1px solid var(--control-border)",
    background: "color-mix(in srgb, var(--paper) 82%, transparent)",
    color: color.textMuted,
    boxShadow: "var(--app-press-shadow, var(--shadow-e1))",
  },
  quiet: {
    border: "1px solid transparent",
    background: "transparent",
    color: color.textMuted,
    boxShadow: shadow.none,
  },
  ghost: {
    border: "1px solid var(--control-border)",
    background: "color-mix(in srgb, var(--paper) 66%, transparent)",
    color: color.textMuted,
    boxShadow: shadow.none,
  },
  danger: {
    border: `1px solid ${color.dangerLine}`,
    background: "color-mix(in srgb, var(--danger) 6%, transparent)",
    color: color.danger,
    boxShadow: shadow.none,
  },
  active: {
    color: color.textStrong,
    background: "var(--control-surface-selected)",
    boxShadow: "var(--app-press-shadow, var(--shadow-e1))",
  },
  disabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    border: `1px solid ${color.border}`,
    borderTopColor: "currentColor",
    animation: "appButtonSpin 800ms linear infinite",
  },
} satisfies Record<string, CSSProperties>;
