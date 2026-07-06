"use client";

import { useEffect } from "react";

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
