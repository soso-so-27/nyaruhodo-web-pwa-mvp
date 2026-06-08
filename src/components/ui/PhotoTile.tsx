"use client";

import type { CSSProperties, ReactNode } from "react";
import { color, radius, shadow, spacing, typography } from "./designTokens";
import { StoredPhotoImage } from "./StoredPhotoImage";

type PhotoTileSize = "sm" | "md" | "lg";
type PhotoTileShape = "rounded" | "circle";

type PhotoTileProps = {
  src?: string;
  alt?: string;
  label?: string;
  size?: PhotoTileSize;
  shape?: PhotoTileShape;
  muted?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  imageStyle?: CSSProperties;
};

export function PhotoTile({
  src,
  alt = "",
  label,
  size = "md",
  shape = "rounded",
  muted = false,
  children,
  style,
  imageStyle,
}: PhotoTileProps) {
  const frameStyle = {
    ...styles.frame,
    ...sizeStyles[size],
    ...(shape === "circle" ? styles.circle : styles.rounded),
    ...(muted ? styles.mutedFrame : null),
    ...imageStyle,
  };

  return (
    <span style={{ ...styles.root, ...style }}>
      {src ? (
        <StoredPhotoImage src={src} alt={alt} style={frameStyle} />
      ) : (
        <span style={frameStyle}>{children}</span>
      )}
      {label ? <span style={styles.label}>{label}</span> : null}
    </span>
  );
}

const styles = {
  root: {
    display: "inline-grid",
    justifyItems: "center",
    gap: spacing.sm,
  },
  frame: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    objectFit: "cover",
    border: "6px solid rgba(255,253,248,0.82)",
    background: color.surfaceSoft,
    boxShadow: "0 10px 22px rgba(90,76,60,0.075)",
    overflow: "hidden",
  },
  rounded: {
    borderRadius: radius.card,
  },
  circle: {
    borderRadius: radius.circle,
  },
  mutedFrame: {
    opacity: 0.72,
    boxShadow: shadow.soft,
  },
  label: {
    color: color.textMuted,
    fontFamily: typography.fontSans,
    fontSize: 12.5,
    fontWeight: 560,
    lineHeight: 1.3,
    letterSpacing: "0.04em",
  },
} satisfies Record<string, CSSProperties>;

const sizeStyles = {
  sm: {
    width: 72,
    height: 72,
  },
  md: {
    width: 112,
    height: 112,
  },
  lg: {
    width: 148,
    height: 148,
  },
} satisfies Record<string, CSSProperties>;
