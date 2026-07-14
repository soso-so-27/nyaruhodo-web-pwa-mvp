"use client";

import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

type ModalBehaviorOptions = {
  open: boolean;
  onClose: () => void;
  lockScroll?: boolean;
};

export function useModalBehavior<ElementType extends HTMLElement>({
  open,
  onClose,
  lockScroll = true,
}: ModalBehaviorOptions): {
  modalRef: RefObject<ElementType | null>;
  handleModalKeyDown: (event: KeyboardEvent<ElementType>) => void;
} {
  const modalRef = useRef<ElementType | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

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

  function handleModalKeyDown(event: KeyboardEvent<ElementType>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
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

  return { modalRef, handleModalKeyDown };
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
