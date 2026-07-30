"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";

import { AppButton } from "./AppButton";
import { useModalBehavior } from "./useModalBehavior";

export type CatChoicePreviewItem = {
  id: string;
  disabled?: boolean;
};

export function CatChoicePreview({
  items,
  activeId,
  onActiveChange,
  onBack,
  backLabel = "一覧",
  onConfirm,
  renderPhoto,
  heading,
  confirmLabel,
  confirmBusyLabel = "処理しています…",
  supportingText,
  supportingTextPlacement = "after",
  confirmStyle,
  confirmDisabled = false,
  isConfirming = false,
  errorMessage = "",
  onSecondaryAction,
  secondaryActionLabel,
  tone = "dark",
  manageHistory = false,
  testId = "cat-choice-preview",
  confirmTestId = "cat-choice-preview-confirm",
}: {
  items: CatChoicePreviewItem[];
  activeId: string;
  onActiveChange: (id: string, index: number) => void;
  onBack: () => void;
  backLabel?: string;
  onConfirm: () => void;
  renderPhoto: (
    item: CatChoicePreviewItem,
    index: number,
    variant: "main" | "thumbnail",
  ) => ReactNode;
  heading?: string;
  confirmLabel: string;
  confirmBusyLabel?: string;
  supportingText?: string;
  supportingTextPlacement?: "before" | "after";
  confirmStyle?: CSSProperties;
  confirmDisabled?: boolean;
  isConfirming?: boolean;
  errorMessage?: string;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
  tone?: "dark" | "paper";
  manageHistory?: boolean;
  testId?: string;
  confirmTestId?: string;
}) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const { modalRef, handleModalKeyDown, requestModalClose } =
    useModalBehavior<HTMLDivElement>({
      open: true,
      onClose: onBack,
      manageHistory,
      initialFocus: "container",
    });
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const currentItem = items[currentIndex] ?? null;
  const isPaperTone = tone === "paper";

  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, []);

  function move(direction: -1 | 1) {
    if (isConfirming) {
      return;
    }
    for (
      let nextIndex = currentIndex + direction;
      nextIndex >= 0 && nextIndex < items.length;
      nextIndex += direction
    ) {
      const nextItem = items[nextIndex];
      if (!nextItem || nextItem.disabled) {
        continue;
      }
      onActiveChange(nextItem.id, nextIndex);
      return;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
      return;
    }
    handleModalKeyDown(event);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }
    move(deltaX > 0 ? -1 : 1);
  }

  if (!currentItem || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={modalRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-busy={isConfirming}
      aria-labelledby={
        heading ? `${testId}-heading` : `${testId}-title`
      }
      data-testid={testId}
      data-photo-id={currentItem.id}
      data-position={currentIndex + 1}
      data-tone={tone}
      style={{
        ...styles.overlay,
        ...(isPaperTone ? styles.overlayPaper : {}),
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      <div style={styles.shell}>
        <header style={styles.header}>
          <button
            type="button"
            data-testid={`${testId}-back`}
            disabled={isConfirming}
            onClick={requestModalClose}
            style={{
              ...styles.backButton,
              ...(isPaperTone ? styles.backButtonPaper : {}),
            }}
          >
            <span aria-hidden="true">‹</span>
            <span>{backLabel}</span>
          </button>
          <p id={`${testId}-title`} style={styles.visuallyHidden}>
            猫を大きく見る
          </p>
          <p
            style={{
              ...styles.position,
              ...(isPaperTone ? styles.positionPaper : {}),
            }}
            aria-label={`${currentIndex + 1}枚目`}
            aria-live="polite"
          >
            {currentIndex + 1} / {items.length}
          </p>
        </header>

        <div
          style={{
            ...styles.photoStage,
            ...(isPaperTone ? styles.photoStagePaper : {}),
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {isPaperTone && heading ? (
            <h2
              id={`${testId}-heading`}
              style={{ ...styles.heading, ...styles.headingPaper }}
            >
              {heading}
            </h2>
          ) : null}
          <div style={styles.photoFrame}>
            {renderPhoto(currentItem, currentIndex, "main")}
          </div>
        </div>

        <div style={styles.controls}>
          <div
            role="group"
            aria-label="届いた猫の一覧"
            style={styles.thumbnailList}
          >
            {items.map((item, index) => {
              const isActive = item.id === currentItem.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`${index + 1}匹目を大きく見る`}
                  aria-current={isActive ? "true" : undefined}
                  disabled={item.disabled || isConfirming}
                  data-testid={`${testId}-thumbnail`}
                  data-photo-id={item.id}
                  data-active={isActive ? "true" : "false"}
                  onClick={() => onActiveChange(item.id, index)}
                  style={{
                    ...styles.thumbnailButton,
                    ...(isPaperTone ? styles.thumbnailButtonPaper : {}),
                    ...(isActive ? styles.thumbnailButtonActive : {}),
                    ...(isPaperTone && isActive
                      ? styles.thumbnailButtonActivePaper
                      : {}),
                    ...(item.disabled ? styles.thumbnailButtonDisabled : {}),
                  }}
                >
                  {renderPhoto(item, index, "thumbnail")}
                </button>
              );
            })}
          </div>

          {heading && !isPaperTone ? (
            <h2 id={`${testId}-heading`} style={styles.heading}>
              {heading}
            </h2>
          ) : null}

          {errorMessage ? (
            <p
              role="alert"
              style={{
                ...styles.error,
                ...(isPaperTone ? styles.errorPaper : {}),
              }}
            >
              {errorMessage}
            </p>
          ) : null}

          {supportingText && supportingTextPlacement === "before" ? (
            <p
              style={{
                ...styles.supportingText,
                ...(isPaperTone ? styles.supportingTextPaper : {}),
              }}
            >
              {supportingText}
            </p>
          ) : null}

          <AppButton
            type="button"
            fullWidth
            data-testid={confirmTestId}
            disabled={confirmDisabled}
            loading={isConfirming}
            loadingLabel={confirmBusyLabel}
            onClick={onConfirm}
            style={{ ...styles.confirmButton, ...confirmStyle }}
          >
            {confirmLabel}
          </AppButton>

          {supportingText && supportingTextPlacement === "after" ? (
            <p
              style={{
                ...styles.supportingText,
                ...(isPaperTone ? styles.supportingTextPaper : {}),
              }}
            >
              {supportingText}
            </p>
          ) : null}

          {onSecondaryAction && secondaryActionLabel ? (
            <button
              type="button"
              disabled={isConfirming}
              onClick={onSecondaryAction}
              style={{
                ...styles.secondaryButton,
                ...(isPaperTone ? styles.secondaryButtonPaper : {}),
              }}
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 2400,
    width: "100vw",
    height: "100dvh",
    overflow: "hidden",
    background: "linear-gradient(180deg, #292522, #1a1715)",
    color: "#fffaf2",
    fontFamily: "var(--font-ui)",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
  },
  overlayPaper: {
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: "var(--ink)",
  },
  shell: {
    width: "min(100%, 760px)",
    height: "100%",
    margin: "0 auto",
    padding:
      "calc(env(safe-area-inset-top, 0px) + 8px) 16px calc(env(safe-area-inset-bottom, 0px) + 12px)",
    display: "grid",
    gridTemplateRows: "48px minmax(0, 1fr) auto",
    gap: "8px",
    boxSizing: "border-box",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "88px 1fr 88px",
    alignItems: "center",
  },
  backButton: {
    minWidth: 0,
    minHeight: "44px",
    padding: "0 6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "5px",
    border: 0,
    borderRadius: "10px",
    background: "transparent",
    color: "rgba(255, 250, 242, 0.88)",
    fontFamily: "var(--font-ui)",
    fontSize: "14px",
    fontWeight: 400,
    cursor: "pointer",
  },
  backButtonPaper: {
    color: "var(--ink)",
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  position: {
    margin: 0,
    paddingRight: "6px",
    color: "rgba(255, 250, 242, 0.65)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.4,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  positionPaper: {
    color: "var(--ink-soft)",
  },
  photoStage: {
    minHeight: 0,
    display: "grid",
    placeItems: "center",
    touchAction: "pan-y",
  },
  photoStagePaper: {
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: "8px",
  },
  photoFrame: {
    width: "100%",
    height: "100%",
    minHeight: 0,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    background: "transparent",
  },
  controls: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    display: "grid",
    justifyItems: "center",
    gap: "7px",
  },
  thumbnailList: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  thumbnailButton: {
    width: "min(15vw, 62px)",
    minWidth: "48px",
    maxWidth: "62px",
    aspectRatio: "1 / 1",
    padding: 0,
    overflow: "hidden",
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: "12px",
    background: "rgba(255, 250, 242, 0.08)",
    opacity: 0.68,
    cursor: "pointer",
    transition:
      "border-color 140ms ease, opacity 140ms ease, transform 140ms ease",
  },
  thumbnailButtonPaper: {
    background: "var(--paper-warm)",
  },
  thumbnailButtonActive: {
    borderColor: "#c77769",
    opacity: 1,
    transform: "translateY(-1px)",
  },
  thumbnailButtonActivePaper: {
    borderColor: "var(--seal)",
  },
  thumbnailButtonDisabled: {
    opacity: 0.28,
    cursor: "default",
  },
  confirmButton: {
    width: "100%",
    minHeight: "50px",
    background: "#b9685c",
    color: "#fffaf2",
  },
  heading: {
    margin: "1px 0 -1px",
    color: "inherit",
    fontFamily: "var(--font-ui)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.45,
    letterSpacing: "0.01em",
    textAlign: "center",
  },
  headingPaper: {
    margin: 0,
    fontSize: "20px",
    lineHeight: 1.4,
  },
  supportingText: {
    margin: 0,
    paddingBottom: "2px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.55,
    letterSpacing: 0,
    textAlign: "center",
  },
  supportingTextPaper: {
    color: "#51483e",
    fontSize: "13px",
  },
  secondaryButton: {
    minHeight: "38px",
    padding: "4px 12px",
    border: 0,
    background: "transparent",
    color: "rgba(255, 250, 242, 0.58)",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 400,
    cursor: "pointer",
  },
  secondaryButtonPaper: {
    color: "var(--ink-soft)",
  },
  error: {
    margin: 0,
    color: "#f0aaa0",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
    textAlign: "center",
  },
  errorPaper: {
    color: "var(--danger)",
  },
};
