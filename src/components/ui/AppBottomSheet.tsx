"use client";

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AppButton } from "./AppButton";
import { CloseIcon } from "./AppIcons";

type LegacySheetVariant = "dark" | "paper";
type AppSheetPlacement = "bottom" | "center";
type AppSheetSize = "content" | "medium" | "full";
type AppSheetVariant = "paper" | "dim" | LegacySheetVariant;

export type AppSheetProps = {
  open?: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  showCloseButton?: boolean;
  placement?: AppSheetPlacement;
  size?: AppSheetSize;
  variant?: AppSheetVariant;
  closeOnOverlay?: boolean;
  showHandle?: boolean;
  lockScroll?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  headerAction?: ReactNode;
  footer?: ReactNode;
  style?: CSSProperties;
};

export type AppBottomSheetProps = Omit<
  AppSheetProps,
  "placement" | "variant" | "open"
> & {
  title: string;
  variant?: LegacySheetVariant;
};

export function AppBottomSheet(props: AppBottomSheetProps) {
  return <AppSheet {...props} open placement="bottom" />;
}

// AppSheet owns screen-level overlays. Keep small menus/popovers on AppCard
// variant="floating" so sheet-level focus and scroll behavior stays centralized.
export function AppSheet({
  open = true,
  title,
  children,
  onClose,
  closeLabel = "閉じる",
  showCloseButton = true,
  placement = "bottom",
  size = "content",
  variant = "paper",
  closeOnOverlay = true,
  showHandle,
  lockScroll = true,
  initialFocusRef,
  headerAction,
  footer,
  style,
}: AppSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const resolvedVariant = variant === "dark" ? "dim" : variant;
  const isBottom = placement === "bottom";
  const shouldShowHandle = showHandle ?? isBottom;

  useEffect(() => {
    if (!open || !lockScroll || typeof document === "undefined") {
      return;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [open, lockScroll]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = window.setTimeout(() => {
      const firstFocusable =
        initialFocusRef?.current ?? getFocusableElements(sheetRef.current)[0] ?? sheetRef.current;
      firstFocusable?.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, initialFocusRef]);

  if (!open) {
    return null;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = getFocusableElements(sheetRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      sheetRef.current?.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const sheetStyle = {
    ...styles.sheet,
    ...(isBottom ? styles.bottomSheet : styles.centerSheet),
    ...styles[resolvedVariant],
    ...styles[size],
    ...style,
  };

  return (
    <>
      <style>{sheetKeyframes}</style>
      <div
        style={{
          ...styles.backdrop,
          ...(resolvedVariant === "dim" ? styles.backdropDim : styles.backdropPaper),
        }}
        data-app-sheet-backdrop=""
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />
      <section
        ref={sheetRef}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        data-app-sheet=""
        onKeyDown={handleKeyDown}
      >
        {shouldShowHandle ? <div style={styles.handle} aria-hidden="true" /> : null}
        <div style={styles.header}>
          {title ? (
            <p id={titleId} style={styles.title}>
              {title}
            </p>
          ) : (
            <span aria-hidden="true" />
          )}
          <div style={styles.headerActions}>
            {headerAction}
            {showCloseButton ? (
              <AppButton
                type="button"
                onClick={onClose}
                variant="ghost"
                size="icon"
                iconOnly
                aria-label={closeLabel}
              >
                <CloseIcon size={18} />
              </AppButton>
            ) : null}
          </div>
        </div>
        <div style={styles.body}>{children}</div>
        {footer ? <div style={styles.footer}>{footer}</div> : null}
      </section>
    </>
  );
}

function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) {
    return [];
  }

  const selector = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const isDisabled =
      element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";

    return !isDisabled && element.offsetParent !== null;
  });
}

const sheetKeyframes = `
@keyframes appSheetBackdropIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes appSheetBottomIn {
  from {
    opacity: 0;
    transform: translate3d(0, 18px, 0) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}
@keyframes appSheetCenterIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) translate3d(0, 10px, 0) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-app-sheet],
  [data-app-sheet-backdrop] {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}`;

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    willChange: "opacity",
    animation: "appSheetBackdropIn var(--dur-instant) var(--ease-gentle)",
  },
  backdropPaper: {
    background: "color-mix(in srgb, var(--ink) 16%, transparent)",
  },
  backdropDim: {
    background: "color-mix(in srgb, var(--ink) 22%, transparent)",
  },
  sheet: {
    position: "fixed",
    zIndex: 61,
    display: "flex",
    flexDirection: "column",
    color: "var(--ink)",
    boxShadow: "var(--shadow-e2)",
    outline: "none",
    overflow: "hidden",
    willChange: "transform, opacity",
  },
  bottomSheet: {
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "calc(100dvh - 24px - env(safe-area-inset-top))",
    borderRadius: "24px 24px 0 0",
    padding: "8px 16px calc(40px + env(safe-area-inset-bottom))",
    transformOrigin: "50% 100%",
    animation: "appSheetBottomIn var(--dur-move) var(--ease-settle)",
  },
  centerSheet: {
    left: "50%",
    top: "50%",
    width: "min(calc(100vw - 32px), 430px)",
    maxHeight:
      "calc(100dvh - 48px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
    borderRadius: "var(--radius-2xl)",
    padding: "16px",
    transform: "translate(-50%, -50%)",
    transformOrigin: "50% 50%",
    animation: "appSheetCenterIn var(--dur-move) var(--ease-settle)",
  },
  paper: {
    background: "var(--paper)",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
  },
  dim: {
    background: "color-mix(in srgb, var(--paper) 96%, transparent)",
    backdropFilter: "blur(28px)",
    WebkitBackdropFilter: "blur(28px)",
  },
  content: {
    height: "auto",
  },
  medium: {
    minHeight: "min(420px, calc(100dvh - 96px))",
  },
  full: {
    height: "calc(100dvh - 24px - env(safe-area-inset-top))",
  },
  handle: {
    width: "40px",
    height: "4px",
    borderRadius: "var(--radius-full)",
    background: "var(--line)",
    margin: "0 auto 16px",
    flex: "0 0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "16px",
    flex: "0 0 auto",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 400,
    color: "var(--ink)",
    margin: 0,
    letterSpacing: 0,
  },
  headerActions: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    flex: "0 0 auto",
  },
  body: {
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  footer: {
    flex: "0 0 auto",
    paddingTop: "8px",
    background: "inherit",
  },
} satisfies Record<string, CSSProperties>;
