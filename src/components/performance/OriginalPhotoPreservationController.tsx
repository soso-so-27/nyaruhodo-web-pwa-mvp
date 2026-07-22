"use client";

import { useEffect, useState } from "react";

import {
  ORIGINAL_PHOTO_PRESERVATION_FAILED_EVENT,
  startOriginalPhotoPreservationQueue,
} from "../../lib/photoOriginals";

export function OriginalPhotoPreservationController() {
  const [isWarningVisible, setIsWarningVisible] = useState(false);

  useEffect(() => {
    const stopQueue = startOriginalPhotoPreservationQueue();
    let hideTimer: number | null = null;
    const showWarning = () => {
      setIsWarningVisible(true);
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => setIsWarningVisible(false), 8000);
    };

    window.addEventListener(
      ORIGINAL_PHOTO_PRESERVATION_FAILED_EVENT,
      showWarning,
    );

    return () => {
      stopQueue();
      window.removeEventListener(
        ORIGINAL_PHOTO_PRESERVATION_FAILED_EVENT,
        showWarning,
      );
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
    };
  }, []);

  if (!isWarningVisible) {
    return null;
  }

  return (
    <p
      role="alert"
      data-testid="original-photo-preservation-warning"
      style={{
        position: "fixed",
        zIndex: 1200,
        right: 16,
        bottom: "calc(92px + env(safe-area-inset-bottom, 0px))",
        left: 16,
        margin: "0 auto",
        maxWidth: 440,
        padding: "12px 16px",
        border: "1px solid rgba(116, 83, 68, 0.2)",
        borderRadius: 8,
        background: "rgba(255, 250, 242, 0.98)",
        color: "var(--ink, #4a3f35)",
        boxShadow: "0 8px 24px rgba(74, 63, 53, 0.14)",
        fontSize: 14,
        lineHeight: 1.7,
        textAlign: "center",
      }}
    >
      元の画質で写真を保管できませんでした。通信を確認して、もう一度写真を選んでください。
    </p>
  );
}
