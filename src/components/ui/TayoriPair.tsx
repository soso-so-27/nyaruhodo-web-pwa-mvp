"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { color, radius, shadow, spacing, typography } from "./designTokens";
import { StoredPhotoImage } from "./StoredPhotoImage";

type TayoriPairSize = "home" | "album" | "albumCompact";

type TayoriPairPhoto = {
  src: string;
};

type TayoriPairProps = {
  ownPhoto?: TayoriPairPhoto | null;
  deliveredPhoto?: TayoriPairPhoto | null;
  ownLabel?: string;
  deliveredLabel?: string;
  size?: TayoriPairSize;
  ownAlt?: string;
  deliveredAlt?: string;
  ownAriaLabel?: string;
  deliveredAriaLabel?: string;
  ownFallback?: ReactNode;
  deliveredFallback?: ReactNode;
  deliveredFallbackPlacement?: "tayori" | "below";
  onOwnClick?: () => void;
  onDeliveredClick?: () => void;
  onDeliveredStorageDataUrl?: (dataUrl: string) => void;
  showOwnLabel?: boolean;
  showDeliveredLabel?: boolean;
  deliveredTayoriHidden?: boolean;
  deliveredTayoriTestId?: string;
  "data-testid"?: string;
};

export function TayoriPair({
  ownPhoto,
  deliveredPhoto,
  ownLabel,
  deliveredLabel,
  size = "album",
  ownAlt = "",
  deliveredAlt = "",
  ownAriaLabel,
  deliveredAriaLabel,
  ownFallback,
  deliveredFallback,
  deliveredFallbackPlacement = "tayori",
  onOwnClick,
  onDeliveredClick,
  onDeliveredStorageDataUrl,
  showOwnLabel = false,
  showDeliveredLabel = false,
  deliveredTayoriHidden = false,
  deliveredTayoriTestId,
  "data-testid": testId,
}: TayoriPairProps) {
  const isHome = size === "home";
  const isAlbumCompact = size === "albumCompact";
  const frameStyle = isHome
    ? styles.homeFrame
    : isAlbumCompact
      ? styles.albumCompactFrame
      : styles.albumFrame;
  const tayoriStyle = isHome ? styles.homeTayori : styles.albumTayori;
  const shouldShowTayoriFallback =
    !deliveredPhoto &&
    Boolean(deliveredFallback) &&
    deliveredFallbackPlacement === "tayori";
  const shouldShowBelowFallback =
    !deliveredPhoto &&
    Boolean(deliveredFallback) &&
    deliveredFallbackPlacement === "below";

  return (
    <div
      style={{
        ...styles.root,
        ...(isHome
          ? styles.homeRoot
          : isAlbumCompact
            ? styles.albumCompactRoot
            : styles.albumRoot),
      }}
      data-testid={testId}
    >
      <span style={{ ...styles.ownFrame, ...frameStyle }}>
        {ownPhoto ? (
          <StoredPhotoImage src={ownPhoto.src} alt={ownAlt} style={styles.ownImage} />
        ) : (
          <span style={styles.ownFallback}>{ownFallback}</span>
        )}
        {ownPhoto && onOwnClick ? (
          <button
            type="button"
            style={styles.ownHitArea}
            onClick={onOwnClick}
            aria-label={
              ownAriaLabel ?? (ownLabel ? `${ownLabel}の写真を大きく見る` : undefined)
            }
          />
        ) : null}
        {deliveredPhoto ? (
          <PhotoButton
            disabled={!onDeliveredClick}
            onClick={() => onDeliveredClick?.()}
            ariaLabel={
              deliveredAriaLabel ??
              (deliveredLabel ? `${deliveredLabel}の写真を大きく見る` : undefined)
            }
            style={{
              ...styles.tayori,
              ...tayoriStyle,
              ...(deliveredTayoriHidden ? styles.hiddenTayori : {}),
            }}
            testId={deliveredTayoriTestId}
          >
            <span style={styles.tayoriPerforation} aria-hidden="true" />
            <StoredPhotoImage
              src={deliveredPhoto.src}
              alt={deliveredAlt}
              style={styles.tayoriImage}
              onStorageDataUrl={onDeliveredStorageDataUrl}
            />
          </PhotoButton>
        ) : shouldShowTayoriFallback ? (
          <button
            type="button"
            style={{
              ...styles.tayoriMissing,
              ...tayoriStyle,
              ...styles.buttonReset,
              ...(deliveredTayoriHidden ? styles.hiddenTayori : {}),
            }}
            onClick={onDeliveredClick}
            disabled={!onDeliveredClick}
            aria-label={deliveredAriaLabel}
            data-testid={deliveredTayoriTestId}
          >
            {deliveredFallback}
          </button>
        ) : null}
      </span>
      {(showOwnLabel && ownLabel) || (showDeliveredLabel && deliveredLabel) ? (
        <div style={styles.labels}>
          {showOwnLabel && ownLabel ? <span>{ownLabel}</span> : null}
          {showDeliveredLabel && deliveredLabel && deliveredPhoto ? (
            <span>{deliveredLabel}</span>
          ) : null}
        </div>
      ) : null}
      {shouldShowBelowFallback ? (
        <button
          type="button"
          style={{ ...styles.belowNotice, ...styles.buttonReset }}
          onClick={onDeliveredClick}
          disabled={!onDeliveredClick}
          aria-label={deliveredAriaLabel}
        >
          {deliveredFallback}
        </button>
      ) : null}
    </div>
  );
}

function PhotoButton({
  children,
  disabled,
  onClick,
  ariaLabel,
  style,
  testId,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  ariaLabel?: string;
  style: CSSProperties;
  testId?: string;
}) {
  if (onClick && !disabled) {
    return (
      <button
        type="button"
        style={{ ...style, ...styles.buttonReset }}
        onClick={onClick}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {children}
      </button>
    );
  }

  return (
    <span style={style} data-testid={testId}>
      {children}
    </span>
  );
}

const styles = {
  root: {
    display: "grid",
    justifyItems: "center",
    gap: spacing.sm,
  },
  homeRoot: {
    width: "min(78vw, 260px)",
  },
  albumRoot: {
    width: "100%",
  },
  albumCompactRoot: {
    width: "min(100%, 300px)",
  },
  ownFrame: {
    position: "relative",
    display: "block",
    overflow: "visible",
    border: `8px solid ${color.paper}`,
    background: color.paper,
    boxShadow: shadow.e1,
  },
  homeFrame: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: radius.xl,
  },
  albumFrame: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: radius.lg,
  },
  albumCompactFrame: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: radius.lg,
  },
  ownImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    borderRadius: radius.lg,
  },
  ownHitArea: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    border: "none",
    padding: 0,
    background: "transparent",
    borderRadius: "inherit",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  ownFallback: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    padding: spacing.md,
    color: color.textMuted,
    fontFamily: typography.fontDisplay,
    fontSize: 12,
    lineHeight: 1.45,
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
    background: "color-mix(in srgb, var(--paper) 76%, transparent)",
    borderRadius: radius.lg,
  },
  tayori: {
    position: "absolute",
    right: -8,
    top: -8,
    zIndex: 2,
    display: "block",
    padding: 6,
    transform: "rotate(4deg)",
    borderRadius: radius.md,
    background: color.surfaceSoft,
    boxShadow: shadow.e1,
    overflow: "hidden",
  },
  homeTayori: {
    width: 88,
    aspectRatio: "1 / 1",
  },
  albumTayori: {
    width: "38%",
    aspectRatio: "1 / 1",
  },
  tayoriPerforation: {
    position: "absolute",
    inset: 5,
    border: `1px dashed ${color.border}`,
    borderRadius: radius.sm,
    pointerEvents: "none",
  },
  tayoriImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    borderRadius: radius.sm,
  },
  tayoriMissing: {
    position: "absolute",
    right: -8,
    top: -8,
    zIndex: 2,
    display: "grid",
    placeItems: "center",
    padding: 6,
    transform: "rotate(4deg)",
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    background: "color-mix(in srgb, var(--paper) 84%, transparent)",
    color: color.textFaint,
    fontFamily: typography.fontDisplay,
    fontSize: 12,
    lineHeight: 1.35,
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
    boxShadow: shadow.e1,
  },
  hiddenTayori: {
    opacity: 0,
    pointerEvents: "none",
  },
  belowNotice: {
    maxWidth: "100%",
    padding: `${spacing.xs} ${spacing.sm}`,
    border: "none",
    background: "transparent",
    color: color.textMuted,
    fontFamily: typography.fontDisplay,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.65,
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
    whiteSpace: "normal",
    overflowWrap: "break-word",
    wordBreak: "keep-all",
  },
  labels: {
    display: "flex",
    justifyContent: "center",
    gap: spacing.lg,
    color: color.textMuted,
    fontFamily: typography.fontDisplay,
    fontSize: 13,
    letterSpacing: "0.1em",
  },
  buttonReset: {
    border: "none",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
} satisfies Record<string, CSSProperties>;
