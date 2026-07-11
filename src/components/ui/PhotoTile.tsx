"use client";

import type { CSSProperties, ReactNode } from "react";
import type { StorageSignedUrlVariant } from "../../lib/photoStorage";
import { color, radius, shadow, spacing, typography } from "./designTokens";
import { StoredPhotoImage } from "./StoredPhotoImage";

type PhotoTileSize = "sm" | "md" | "lg";
type PhotoTileShape = "rounded" | "circle";
type PhotoTileVariant = "tile" | "avatar" | "bare";
type PhotoTileFit = "cover" | "contain";
type PhotoTileAspect = "1 / 1" | "4 / 3" | "3 / 4" | "auto" | (string & {});

type PhotoTileProps = {
  src?: string;
  previewSrc?: string;
  alt?: string;
  label?: string;
  size?: PhotoTileSize;
  shape?: PhotoTileShape;
  variant?: PhotoTileVariant;
  aspect?: PhotoTileAspect;
  fit?: PhotoTileFit;
  muted?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  fallbackLabel?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  imageWidth?: number;
  imageHeight?: number;
  storageVariant?: StorageSignedUrlVariant;
  fallbackSrcs?: string[];
  onStorageDataUrl?: (dataUrl: string) => void;
  onLoad?: () => void;
  onError?: () => void;
  initiallyLoaded?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  frameStyle?: CSSProperties;
  imageStyle?: CSSProperties;
};

export function PhotoTile({
  src,
  previewSrc,
  alt = "",
  label,
  size = "md",
  shape = "rounded",
  variant = "tile",
  aspect = "1 / 1",
  fit = "cover",
  muted = false,
  interactive = false,
  onClick,
  fallbackLabel,
  loading,
  fetchPriority,
  imageWidth,
  imageHeight,
  storageVariant = "thumbnail",
  fallbackSrcs,
  onStorageDataUrl,
  onLoad,
  onError,
  initiallyLoaded,
  children,
  style,
  frameStyle: frameStyleOverride,
  imageStyle,
}: PhotoTileProps) {
  const isAvatar = variant === "avatar" || shape === "circle";
  const isBare = variant === "bare";
  const frameStyle = {
    ...styles.frame,
    ...sizeStyles[size],
    ...(aspect !== "auto" ? { aspectRatio: aspect } : null),
    ...(isBare
      ? styles.bareFrame
      : isAvatar
        ? styles.avatarFrame
        : styles.rounded),
    ...(muted ? styles.mutedFrame : null),
    ...frameStyleOverride,
  };
  const isInteractive = interactive || Boolean(onClick);
  const rootStyle = {
    ...styles.root,
    ...(isInteractive ? styles.interactiveRoot : null),
    ...style,
  };
  const content = (
    <>
      {src ? (
        <StoredPhotoImage
          src={src}
          previewSrc={previewSrc}
          alt={alt}
          style={{ ...frameStyle, objectFit: fit }}
          imageStyle={imageStyle}
          storageVariant={storageVariant}
          loading={loading}
          fetchPriority={fetchPriority}
          width={imageWidth ?? getPhotoTileIntrinsicSize(size)}
          height={imageHeight ?? getPhotoTileIntrinsicSize(size)}
          fallbackSrcs={fallbackSrcs}
          fallbackVariant="quiet"
          onStorageDataUrl={onStorageDataUrl}
          onLoad={onLoad}
          onError={onError}
          initiallyLoaded={initiallyLoaded}
        />
      ) : (
        <span style={frameStyle}>{children ?? fallbackLabel}</span>
      )}
      {label ? <span style={styles.label}>{label}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" style={rootStyle} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <span style={rootStyle}>{content}</span>
  );
}

type PhotoViewerFrameProps = {
  src: string;
  previewSrc?: string;
  alt?: string;
  aspect?: PhotoTileAspect;
  fit?: PhotoTileFit;
  fallbackSrcs?: string[];
  onStorageDataUrl?: (dataUrl: string) => void;
  onNaturalSize?: (size: { width: number; height: number }) => void;
  storageVariant?: StorageSignedUrlVariant;
  style?: CSSProperties;
  imageStyle?: CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  children?: ReactNode;
};

export function PhotoViewerFrame({
  src,
  previewSrc,
  alt = "",
  aspect = "1 / 1",
  fit = "cover",
  fallbackSrcs,
  onStorageDataUrl,
  onNaturalSize,
  storageVariant = "display",
  style,
  imageStyle,
  loading,
  fetchPriority,
  children,
}: PhotoViewerFrameProps) {
  return (
    <span
      style={{
        ...styles.viewerFrame,
        ...(aspect !== "auto" ? { aspectRatio: aspect } : null),
        ...style,
      }}
    >
      <StoredPhotoImage
        src={src}
        previewSrc={previewSrc}
        alt={alt}
        style={{ ...styles.viewerImage, objectFit: fit }}
        imageStyle={imageStyle}
        storageVariant={storageVariant}
        loading={loading}
        fetchPriority={fetchPriority}
        fallbackSrcs={fallbackSrcs}
        onStorageDataUrl={onStorageDataUrl}
        onNaturalSize={onNaturalSize}
      />
      {children}
    </span>
  );
}

const styles = {
  root: {
    display: "inline-grid",
    justifyItems: "center",
    gap: spacing.sm,
  },
  interactiveRoot: {
    border: "none",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    padding: 0,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  frame: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    objectFit: "cover",
    border: `6px solid ${color.paper}`,
    background: color.surfaceSoft,
    boxShadow: shadow.e1,
    overflow: "hidden",
  },
  rounded: {
    borderRadius: radius.lg,
  },
  avatarFrame: {
    borderRadius: radius.circle,
  },
  bareFrame: {
    border: "none",
    borderRadius: 0,
    background: "transparent",
    boxShadow: shadow.none,
  },
  mutedFrame: {
    opacity: 0.72,
    boxShadow: shadow.e1,
  },
  label: {
    color: color.textMuted,
    fontFamily: typography.fontSans,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: "0.04em",
  },
  viewerFrame: {
    position: "relative",
    display: "block",
    width: "100%",
    overflow: "hidden",
    border: `8px solid ${color.paper}`,
    borderRadius: radius.xxl24,
    background: color.paper,
    boxShadow: shadow.e2,
  },
  viewerImage: {
    width: "100%",
    height: "100%",
    borderRadius: radius.lg,
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

function getPhotoTileIntrinsicSize(size: PhotoTileSize) {
  return size === "sm" ? 72 : size === "lg" ? 148 : 112;
}
