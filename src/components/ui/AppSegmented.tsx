"use client";

import type { CSSProperties, ReactNode } from "react";
import { color, radius, spacing, typography } from "./designTokens";

export type AppSegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
};

type AppSegmentedProps<T extends string> = {
  value: T;
  options: readonly AppSegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  columns?: number;
  style?: CSSProperties;
};

export function AppSegmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  columns,
  style,
}: AppSegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        ...styles.root,
        ...(columns
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : {}),
        ...style,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            style={{
              ...styles.option,
              ...(selected ? styles.optionSelected : {}),
              ...(option.disabled ? styles.optionDisabled : {}),
            }}
          >
            {option.leading ? (
              <span style={styles.leading} aria-hidden="true">
                {option.leading}
              </span>
            ) : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  root: {
    display: "grid",
    gap: spacing.sm,
  },
  option: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 44,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--control-border)",
    borderRadius: radius.pill,
    background: "color-mix(in srgb, var(--paper) 78%, transparent)",
    color: color.text,
    cursor: "pointer",
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    fontWeight: 500,
    lineHeight: 1.2,
    padding: `0 ${spacing.md}px`,
    transition:
      "background var(--dur-instant) var(--ease-gentle), border-color var(--dur-instant) var(--ease-gentle), color var(--dur-instant) var(--ease-gentle)",
  },
  optionSelected: {
    background: "var(--control-surface-selected)",
    borderColor: "var(--control-border-selected)",
    color: color.textStrong,
  },
  optionDisabled: {
    cursor: "not-allowed",
    opacity: 0.55,
  },
  leading: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
} satisfies Record<string, CSSProperties>;
