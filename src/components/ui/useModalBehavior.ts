"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

type ModalBehaviorOptions = {
  open: boolean;
  onClose: () => void;
  lockScroll?: boolean;
  manageHistory?: boolean;
};

let modalHistorySequence = 0;

export function useModalBehavior<ElementType extends HTMLElement>({
  open,
  onClose,
  lockScroll = true,
  manageHistory = false,
}: ModalBehaviorOptions): {
  modalRef: RefObject<ElementType | null>;
  handleModalKeyDown: (event: KeyboardEvent<ElementType>) => void;
  requestModalClose: () => void;
} {
  const modalRef = useRef<ElementType | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const historyMarkerRef = useRef<string | null>(null);
  if (!historyMarkerRef.current) {
    modalHistorySequence += 1;
    historyMarkerRef.current = `neteruneko-modal-${Date.now()}-${modalHistorySequence}`;
  }
  const pushedHistoryRef = useRef(false);
  const historyCleanupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (lockScroll) {
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = getFocusableElements(modalRef.current)[0] ?? modalRef.current;
      firstFocusable?.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      if (lockScroll) {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
      }

      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [lockScroll, open]);

  useEffect(() => {
    if (!open || !manageHistory || typeof window === "undefined") {
      return;
    }

    const marker = historyMarkerRef.current;
    if (historyCleanupTimerRef.current !== null) {
      window.clearTimeout(historyCleanupTimerRef.current);
      historyCleanupTimerRef.current = null;
    }
    if (window.history.state?.neterunekoModal !== marker) {
      window.history.pushState(
        { ...window.history.state, neterunekoModal: marker },
        "",
        window.location.href,
      );
    }
    pushedHistoryRef.current = true;

    function handlePopState(event: PopStateEvent) {
      if (!pushedHistoryRef.current) {
        return;
      }

      if (event.state?.neterunekoModal === marker) {
        return;
      }

      pushedHistoryRef.current = false;
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (
        pushedHistoryRef.current &&
        window.history.state?.neterunekoModal === marker
      ) {
        // Strict Mode immediately re-runs effects in development. Deferring
        // cleanup lets the second setup keep the same history entry.
        historyCleanupTimerRef.current = window.setTimeout(() => {
          historyCleanupTimerRef.current = null;
          if (
            pushedHistoryRef.current &&
            window.history.state?.neterunekoModal === marker
          ) {
            pushedHistoryRef.current = false;
            window.history.back();
          }
        }, 0);
      }
    };
  }, [manageHistory, open]);

  const requestModalClose = useCallback(() => {
    if (
      manageHistory &&
      pushedHistoryRef.current &&
      typeof window !== "undefined" &&
      window.history.state?.neterunekoModal === historyMarkerRef.current
    ) {
      pushedHistoryRef.current = false;
      window.history.back();
    }

    onCloseRef.current();
  }, [manageHistory]);

  function handleModalKeyDown(event: KeyboardEvent<ElementType>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      requestModalClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = getFocusableElements(modalRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      modalRef.current?.focus({ preventScroll: true });
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
  }

  return { modalRef, handleModalKeyDown, requestModalClose };
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
    const isDisabled =
      element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";

    return !isDisabled && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null;
  });
}
