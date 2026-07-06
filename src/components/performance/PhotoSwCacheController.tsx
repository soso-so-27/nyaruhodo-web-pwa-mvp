"use client";

import { useEffect } from "react";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";

export function PhotoSwCacheController() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const enabled = process.env.NEXT_PUBLIC_ENABLE_SW_IMAGE_CACHE === "true";
    let isActive = true;

    const postConfig = async () => {
      const registration = await navigator.serviceWorker.ready.catch(() => null);

      if (!isActive || !registration) {
        return;
      }

      postServiceWorkerMessage({
        type: "NN_PHOTO_CACHE_CONFIG",
        enabled,
      });
    };

    void postConfig();
    navigator.serviceWorker.addEventListener("controllerchange", postConfig);

    return () => {
      isActive = false;
      navigator.serviceWorker.removeEventListener("controllerchange", postConfig);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        data.type !== "NN_PHOTO_CACHE_TRACE" ||
        typeof data.eventName !== "string"
      ) {
        return;
      }

      trackProductEvent(data.eventName, sanitizeTraceMetadata(data.metadata));
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  return null;
}

function postServiceWorkerMessage(message: unknown) {
  const targets = [
    navigator.serviceWorker.controller,
    navigator.serviceWorker.ready.then((registration) => registration.active),
  ];

  for (const target of targets) {
    if (target instanceof Promise) {
      void target.then((worker) => worker?.postMessage(message)).catch(() => null);
    } else {
      target?.postMessage(message);
    }
  }
}

function sanitizeTraceMetadata(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const allowedKeys = [
    "variant",
    "age_ms",
    "estimated_bytes",
    "entry_count",
    "reason",
    "purged_count",
    "enabled",
    "surface",
    "error_code",
  ];
  const metadata: Record<string, string | number | boolean> = {};

  for (const key of allowedKeys) {
    const entry = (value as Record<string, unknown>)[key];
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      metadata[key] = entry;
    }
  }

  return metadata;
}
