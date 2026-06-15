"use client";

import type {
  CSSProperties,
  FocusEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useState } from "react";
import { color, radius, spacing, typography } from "./designTokens";

type BaseProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  rootStyle?: CSSProperties;
  fieldStyle?: CSSProperties;
};

type InputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "style" | "children"> & {
    as?: "input";
  };

type SelectProps = BaseProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    as: "select";
  };

type TextareaProps = BaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    as: "textarea";
  };

export type AppTextFieldProps = InputProps | SelectProps | TextareaProps;

export function AppTextField(props: AppTextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const {
    label,
    hint,
    error,
    rootStyle,
    fieldStyle,
    id,
  } = props;

  const fieldId = id;
  const hintId = fieldId && hint ? `${fieldId}-hint` : undefined;
  const errorId = fieldId && error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const interactiveFieldStyle = {
    ...(isFocused ? styles.fieldFocused : {}),
    ...fieldStyle,
  };
  const handleFocus = (
    event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setIsFocused(true);
    props.onFocus?.(event as never);
  };
  const handleBlur = (
    event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setIsFocused(false);
    props.onBlur?.(event as never);
  };

  return (
    <label style={{ ...styles.root, ...rootStyle }} htmlFor={fieldId}>
      {label ? <span style={styles.label}>{label}</span> : null}
      {props.as === "select" ? (
        <SelectField
          props={props}
          id={fieldId}
          describedBy={describedBy}
          fieldStyle={interactiveFieldStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      ) : props.as === "textarea" ? (
        <TextareaField
          props={props}
          id={fieldId}
          describedBy={describedBy}
          fieldStyle={interactiveFieldStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      ) : (
        <InputField
          props={props}
          id={fieldId}
          describedBy={describedBy}
          fieldStyle={interactiveFieldStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      )}
      {hint ? (
        <span id={hintId} style={styles.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} style={styles.error}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function InputField({
  props,
  id,
  describedBy,
  fieldStyle,
  onFocus,
  onBlur,
}: {
  props: InputProps;
  id?: string;
  describedBy?: string;
  fieldStyle?: CSSProperties;
  onFocus: (event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}) {
  const { label, hint, error, rootStyle, fieldStyle: _fieldStyle, as, onFocus: _onFocus, onBlur: _onBlur, ...inputProps } = props;
  return (
    <input
      {...inputProps}
      id={id}
      aria-describedby={describedBy}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{ ...styles.field, ...fieldStyle }}
    />
  );
}

function SelectField({
  props,
  id,
  describedBy,
  fieldStyle,
  onFocus,
  onBlur,
}: {
  props: SelectProps;
  id?: string;
  describedBy?: string;
  fieldStyle?: CSSProperties;
  onFocus: (event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}) {
  const { label, hint, error, rootStyle, fieldStyle: _fieldStyle, as, onFocus: _onFocus, onBlur: _onBlur, ...selectProps } = props;
  return (
    <select
      {...selectProps}
      id={id}
      aria-describedby={describedBy}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{ ...styles.field, ...styles.select, ...fieldStyle }}
    />
  );
}

function TextareaField({
  props,
  id,
  describedBy,
  fieldStyle,
  onFocus,
  onBlur,
}: {
  props: TextareaProps;
  id?: string;
  describedBy?: string;
  fieldStyle?: CSSProperties;
  onFocus: (event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}) {
  const { label, hint, error, rootStyle, fieldStyle: _fieldStyle, as, onFocus: _onFocus, onBlur: _onBlur, ...textareaProps } = props;
  return (
    <textarea
      {...textareaProps}
      id={id}
      aria-describedby={describedBy}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{ ...styles.field, ...styles.textarea, ...fieldStyle }}
    />
  );
}

const styles = {
  root: {
    display: "grid",
    gap: spacing.sm,
  },
  label: {
    color: color.textMuted,
    fontFamily: typography.fontUi,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.4,
  },
  field: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 44,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    borderRadius: radius.md,
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    color: color.text,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    fontWeight: 500,
    lineHeight: 1.4,
    padding: `0 ${spacing.md}px`,
    outline: "none",
  },
  fieldFocused: {
    borderColor: color.textMuted,
    boxShadow: "var(--shadow-e0)",
  },
  select: {
    cursor: "pointer",
  },
  textarea: {
    minHeight: 112,
    lineHeight: 1.6,
    padding: spacing.md,
    resize: "vertical",
  },
  hint: {
    color: color.textFaint,
    fontSize: 12,
    lineHeight: 1.5,
  },
  error: {
    color: color.danger,
    fontSize: 12,
    lineHeight: 1.5,
  },
} satisfies Record<string, CSSProperties>;
