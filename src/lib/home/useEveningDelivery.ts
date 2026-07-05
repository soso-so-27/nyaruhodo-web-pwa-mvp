"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { trackProductEvent } from "../analytics/productAnalytics";
import { createSleepingExchange } from "./deliveryCandidates";
import {
  getJstDateKey,
  getJstDeliveryTime,
  getPendingEveningDeliveryDay,
  readEveningDeliveryStore,
  setAppBadge,
  setEveningDeliveredPhoto,
  markEveningDeliverySkipped,
  type EveningDeliveryDay,
} from "./eveningDelivery";
import { recordEveningDeliveryTrace } from "./eveningDeliveryTrace";
import type { OwnSleepingPhoto } from "./sleepingPhotos";

const EXCHANGE_UPLOAD_MAX_DATA_URL_LENGTH = 500_000;
const EVENING_DELIVERY_SLOW_MS = 4_000;

export type ExchangeUploadResizeStep =
  | "storage_direct"
  | "data_resize_420_0.58"
  | "data_resize_320_0.52"
  | "data_resize_240_0.46"
  | "data_resize_180_0.4"
  | "data_original"
  | "data_unusable"
  | "none";

type EveningDeliveryCheckSource =
  | "app_open"
  | "state_change"
  | "focus"
  | "visibilitychange"
  | "pageshow"
  | "delivery_time_reached"
  | "retry";

type EveningDeliveryCheckStatus = {
  state: "idle" | "checking" | "slow" | "failed";
  dateKey: string | null;
};

export function useEveningDelivery({
  activeCatId,
  ownSleepingPhotos,
}: {
  activeCatId: string | null;
  ownSleepingPhotos: OwnSleepingPhoto[];
}) {
  const pendingEveningDeliveryKeysRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [checkRequest, setCheckRequest] = useState<{
    source: EveningDeliveryCheckSource;
    token: number;
  }>({ source: "app_open", token: 0 });
  const [checkStatus, setCheckStatus] = useState<EveningDeliveryCheckStatus>({
    state: "idle",
    dateKey: null,
  });

  const requestDeliveryCheck = useCallback((source: EveningDeliveryCheckSource) => {
    setCheckRequest((current) => ({
      source,
      token: current.token + 1,
    }));
  }, []);

  const ensureEveningDelivery = useCallback(
    async (source: EveningDeliveryCheckSource) => {
      const now = Date.now();
      const todayKey = getJstDateKey(now);
      const store = readEveningDeliveryStore();
      const todayDay = store[todayKey];
      const pendingDay = getPendingEveningDeliveryDay(now);
      const recipientCatId = pendingDay?.targetCatId ?? activeCatId;
      const traceBase = buildEveningDeliveryTraceBase({
        activeCatId,
        now,
        pendingDay,
        todayDay,
        todayKey,
      });

      if (!pendingDay?.targetOwnPhotoId || !recipientCatId) {
        if (todayDay && now >= getJstDeliveryTime(todayKey)) {
          recordEveningDeliveryTrace({
            ...traceBase,
            gate: pendingDay ? "missing_target_or_cat" : "no_pending_day",
          });
        }
        setCheckStatus((current) =>
          current.state === "checking" || current.state === "slow"
            ? { state: "idle", dateKey: null }
            : current,
        );
        return;
      }

      if (pendingEveningDeliveryKeysRef.current.has(pendingDay.dateKey)) {
        recordEveningDeliveryTrace({
          ...traceBase,
          gate: "already_pending",
        });
        return;
      }

      const directOwnPhoto = ownSleepingPhotos.find(
        (photo) => photo.id === pendingDay.targetOwnPhotoId,
      );
      const targetPhoto = directOwnPhoto ? null : pendingDay.targetPhoto;
      const legacyPhoto =
        directOwnPhoto || targetPhoto
          ? null
          : findLegacyEveningDeliveryPhoto(
              pendingDay,
              ownSleepingPhotos,
              recipientCatId,
            );
      const ownPhoto = directOwnPhoto ?? targetPhoto ?? legacyPhoto;
      const selectedPhotoSource = directOwnPhoto
        ? "direct"
        : targetPhoto
          ? "targetPhoto"
          : legacyPhoto
            ? "legacy"
            : "none";

      if (!ownPhoto) {
        recordEveningDeliveryTrace({
          ...traceBase,
          gate: "missing_photo",
          directOwnPhotoFound: Boolean(directOwnPhoto),
          targetPhotoFallbackUsed: Boolean(targetPhoto),
          legacyFallbackUsed: Boolean(legacyPhoto),
          selectedPhotoSource,
        });
        setCheckStatus({ state: "failed", dateKey: pendingDay.dateKey });
        trackEveningDeliveryCheckEvent("evening_delivery_check_failed", {
          startedAt: now,
          source,
          route: getCurrentRoute(),
        });
        return;
      }

      pendingEveningDeliveryKeysRef.current.add(pendingDay.dateKey);
      const checkStartedAt = Date.now();
      const route = getCurrentRoute();
      let slowTimer: number | null = null;

      setCheckStatus({ state: "checking", dateKey: pendingDay.dateKey });
      trackEveningDeliveryCheckEvent("evening_delivery_check_started", {
        startedAt: checkStartedAt,
        source,
        route,
      });

      slowTimer = window.setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }
        setCheckStatus((current) =>
          current.dateKey === pendingDay.dateKey && current.state === "checking"
            ? { state: "slow", dateKey: pendingDay.dateKey }
            : current,
        );
        trackEveningDeliveryCheckEvent("evening_delivery_check_timeout", {
          startedAt: checkStartedAt,
          source,
          route,
        });
      }, EVENING_DELIVERY_SLOW_MS);

      try {
        const uploadSrc = await resolveExchangePhotoUploadSrc(ownPhoto);

        if (!uploadSrc.src) {
          recordEveningDeliveryTrace({
            ...traceBase,
            gate:
              selectedPhotoSource === "legacy"
                ? "legacy_photo_not_data"
                : "photo_not_data",
            directOwnPhotoFound: Boolean(directOwnPhoto),
            targetPhotoFallbackUsed: Boolean(targetPhoto),
            legacyFallbackUsed: selectedPhotoSource === "legacy",
            legacyFallbackReason: "non_data_src",
            selectedPhotoSource,
            selectedPhotoSrcKind: uploadSrc.srcKind,
            exchangeUploadResizeStep: uploadSrc.resizeStep,
            exchangePayloadLength: null,
          });
          pendingEveningDeliveryKeysRef.current.delete(pendingDay.dateKey);
          setCheckStatus({ state: "failed", dateKey: pendingDay.dateKey });
          trackEveningDeliveryCheckEvent("evening_delivery_check_failed", {
            startedAt: checkStartedAt,
            source,
            route,
          });
          return;
        }

        recordEveningDeliveryTrace({
          ...traceBase,
          gate: "exchange_started",
          directOwnPhotoFound: Boolean(directOwnPhoto),
          targetPhotoFallbackUsed: Boolean(targetPhoto),
          legacyFallbackUsed: Boolean(legacyPhoto),
          selectedPhotoSource,
          selectedPhotoSrcKind: uploadSrc.srcKind,
          exchangeUploadResizeStep: uploadSrc.resizeStep,
          exchangePayloadLength: uploadSrc.src.length,
          exchangeCalled: true,
        });

        const exchangeStartedAt = Date.now();
        const result = await createEveningExchangePhoto({
          ownPhoto: {
            ...ownPhoto,
            src: uploadSrc.src,
          },
          seed: `${pendingDay.dateKey}:${ownPhoto.id}`,
          deliveryDateKey: pendingDay.dateKey,
          recipientCatId,
        });

        recordEveningDeliveryTrace({
          ...traceBase,
          gate: "exchange_completed",
          directOwnPhotoFound: Boolean(directOwnPhoto),
          targetPhotoFallbackUsed: Boolean(targetPhoto),
          legacyFallbackUsed: Boolean(legacyPhoto),
          selectedPhotoSource,
          selectedPhotoSrcKind: uploadSrc.srcKind,
          exchangeUploadResizeStep: uploadSrc.resizeStep,
          exchangePayloadLength: uploadSrc.src.length,
          exchangeElapsedMs: Date.now() - exchangeStartedAt,
          exchangeCalled: true,
          exchangeStatus: result.httpStatus,
          exchangeError: result.error,
          exchangePhotoReceived: Boolean(result.photo),
        });

        if (!result.photo) {
          pendingEveningDeliveryKeysRef.current.delete(pendingDay.dateKey);
          if (result.error === "delivery_not_yet") {
            setCheckStatus({ state: "idle", dateKey: null });
            trackProductEvent(
              "exchange_rejected_not_yet",
              {
                delivery_date_key: pendingDay.dateKey,
                http_status: result.httpStatus,
              },
              { localCatId: recipientCatId },
            );
            return;
          }
          if (result.error === "delivery_window_expired") {
            markEveningDeliverySkipped(pendingDay.dateKey);
            setCheckStatus({ state: "failed", dateKey: pendingDay.dateKey });
            trackProductEvent(
              "exchange_rejected_expired",
              {
                delivery_date_key: pendingDay.dateKey,
                http_status: result.httpStatus,
              },
              { localCatId: recipientCatId },
            );
            trackEveningDeliveryCheckEvent("evening_delivery_check_failed", {
              startedAt: checkStartedAt,
              source,
              route,
            });
            return;
          }
          setCheckStatus({ state: "failed", dateKey: pendingDay.dateKey });
          trackProductEvent(
            "delivery_sent",
            {
              delivery_date_key: pendingDay.dateKey,
              poolSource: "none",
              isOnboardingInstant: false,
              isDay1Evening: false,
            },
            { localCatId: recipientCatId },
          );
          trackEveningDeliveryCheckEvent("evening_delivery_check_failed", {
            startedAt: checkStartedAt,
            source,
            route,
          });
          return;
        }

        setEveningDeliveredPhoto(pendingDay.dateKey, result.photo, Date.now());
        void setAppBadge(1);
        setRefreshToken((value) => value + 1);
        setCheckStatus({ state: "idle", dateKey: null });
        trackEveningDeliveryCheckEvent("evening_delivery_check_succeeded", {
          startedAt: checkStartedAt,
          source,
          route,
        });
        trackProductEvent(
          "delivery_sent",
          {
            delivery_date_key: pendingDay.dateKey,
            poolSource: "normal",
            isOnboardingInstant: false,
            isDay1Evening: false,
            tier: result.tier ?? null,
          },
          { localCatId: recipientCatId },
        );
        if (result.tier) {
          trackProductEvent(
            "delivery_tier_served",
            {
              delivery_date_key: pendingDay.dateKey,
              tier: result.tier,
            },
            { localCatId: recipientCatId },
          );
        }
      } catch {
        pendingEveningDeliveryKeysRef.current.delete(pendingDay.dateKey);
        setCheckStatus({ state: "failed", dateKey: pendingDay.dateKey });
        trackEveningDeliveryCheckEvent("evening_delivery_check_failed", {
          startedAt: checkStartedAt,
          source,
          route,
        });
      } finally {
        if (slowTimer !== null) {
          window.clearTimeout(slowTimer);
        }
      }
    },
    [activeCatId, ownSleepingPhotos],
  );

  useEffect(() => {
    mountedRef.current = true;
    requestDeliveryCheck("app_open");

    const handleFocus = () => requestDeliveryCheck("focus");
    const handlePageShow = () => requestDeliveryCheck("pageshow");
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestDeliveryCheck("visibilitychange");
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestDeliveryCheck]);

  useEffect(() => {
    void ensureEveningDelivery("state_change");
  }, [ensureEveningDelivery]);

  useEffect(() => {
    if (checkRequest.token === 0) {
      return;
    }

    void ensureEveningDelivery(checkRequest.source);
  }, [checkRequest, ensureEveningDelivery]);

  useEffect(() => {
    const delay = getNextEveningDeliveryCheckDelay();

    if (delay === null) {
      return;
    }

    const timerId = window.setTimeout(() => {
      requestDeliveryCheck("delivery_time_reached");
    }, delay);

    return () => window.clearTimeout(timerId);
  }, [requestDeliveryCheck, activeCatId, ownSleepingPhotos, refreshToken, checkRequest.token]);

  return {
    refreshToken,
    checkStatus,
    retryEveningDeliveryCheck: () => requestDeliveryCheck("retry"),
  };
}

function getNextEveningDeliveryCheckDelay() {
  const now = Date.now();
  const nextDeliveryTime = Object.values(readEveningDeliveryStore())
    .filter(
      (day) =>
        day.targetOwnPhotoId &&
        !day.deliveredPhoto &&
        !day.skippedAt &&
        getJstDeliveryTime(day.dateKey) > now,
    )
    .map((day) => getJstDeliveryTime(day.dateKey))
    .sort((a, b) => a - b)[0];

  if (!nextDeliveryTime) {
    return null;
  }

  return Math.max(0, nextDeliveryTime - now + 60);
}

function trackEveningDeliveryCheckEvent(
  eventName:
    | "evening_delivery_check_started"
    | "evening_delivery_check_succeeded"
    | "evening_delivery_check_failed"
    | "evening_delivery_check_timeout",
  {
    startedAt,
    source,
    route,
  }: {
    startedAt: number;
    source: EveningDeliveryCheckSource;
    route: string;
  },
) {
  trackProductEvent(eventName, {
    latency_ms: Math.max(0, Date.now() - startedAt),
    source,
    route,
  });
}

function getCurrentRoute() {
  if (typeof window === "undefined") {
    return "unknown";
  }

  return window.location.pathname || "unknown";
}

function buildEveningDeliveryTraceBase({
  activeCatId,
  now,
  pendingDay,
  todayDay,
  todayKey,
}: {
  activeCatId: string | null;
  now: number;
  pendingDay: EveningDeliveryDay | null;
  todayDay?: EveningDeliveryDay;
  todayKey: string;
}) {
  const traceDateKey = pendingDay?.dateKey ?? todayDay?.dateKey ?? todayKey;
  return {
    dateKey: traceDateKey,
    hasTodayEntry: Boolean(todayDay),
    hasPendingDay: Boolean(pendingDay),
    hasDeliveredPhoto: Boolean(todayDay?.deliveredPhoto),
    isAfterDeliveryTime: now >= getJstDeliveryTime(traceDateKey),
    activeCatIdPresent: Boolean(activeCatId),
    targetOwnPhotoIdPresent: Boolean(pendingDay?.targetOwnPhotoId),
    directOwnPhotoFound: false,
    targetPhotoFallbackUsed: false,
    legacyFallbackUsed: false,
    selectedPhotoSource: "none" as const,
    exchangeCalled: false,
    exchangeStatus: null,
    exchangePhotoReceived: false,
  };
}

function findLegacyEveningDeliveryPhoto(
  pendingDay: EveningDeliveryDay,
  ownPhotos: OwnSleepingPhoto[],
  activeCatId: string,
) {
  const targetCatId = pendingDay.targetCatId ?? activeCatId;
  const sameDayPhotos = ownPhotos
    .filter((photo) => {
      const photoCatId = photo.ownerCatId ?? photo.catId;
      return (
        photoCatId === targetCatId &&
        Number.isFinite(photo.createdAt) &&
        getJstDateKey(photo.createdAt) === pendingDay.dateKey
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  if (sameDayPhotos.length === 0) {
    return null;
  }

  if (typeof pendingDay.targetCapturedAt === "number") {
    const nearCapturedAt = sameDayPhotos
      .filter(
        (photo) =>
          Math.abs(photo.createdAt - pendingDay.targetCapturedAt!) <=
          6 * 60 * 60 * 1000,
      )
      .sort(
        (a, b) =>
          Math.abs(a.createdAt - pendingDay.targetCapturedAt!) -
          Math.abs(b.createdAt - pendingDay.targetCapturedAt!),
      )[0];

    if (nearCapturedAt) {
      return nearCapturedAt;
    }
  }

  return sameDayPhotos[0] ?? null;
}

async function createEveningExchangePhoto({
  ownPhoto,
  seed,
  deliveryDateKey,
  recipientCatId,
}: {
  ownPhoto: OwnSleepingPhoto;
  seed: string;
  deliveryDateKey: string;
  recipientCatId: string | null;
}) {
  const result = await createSleepingExchange({
    ownPhoto,
    triggerLabel: ownPhoto.triggerLabel,
    theme: ownPhoto.theme,
    category: "sleep",
    seed,
    deliveryDateKey,
    recipientCatId,
  });

  if (!result?.photo) {
    return {
      photo: null,
      httpStatus: result?.httpStatus ?? null,
      error: result?.error ?? null,
      tier: null,
    };
  }

  return {
    photo: result.photo,
    httpStatus: result.httpStatus ?? null,
    error: result.error ?? null,
    tier: result.tier ?? null,
  };
}

function isDeliverableDataPhotoSrc(src: string) {
  return /^data:image\/(?:jpeg|jpg|png|webp);base64,/.test(src);
}

function getExchangePhotoUploadSrc(photo: OwnSleepingPhoto) {
  return (
    [
      photo.src,
      photo.displaySrc,
      photo.thumbnailSrc,
      photo.originalSrc,
    ].find((src): src is string => Boolean(src && isDeliverableDataPhotoSrc(src))) ??
    null
  );
}

export async function resolveExchangePhotoUploadSrc(photo: OwnSleepingPhoto): Promise<{
  src: string | null;
  srcKind: ReturnType<typeof getTracePhotoSrcKind>;
  resizeStep: ExchangeUploadResizeStep;
}> {
  const storageSrc = getExchangePhotoStorageSrc(photo);

  if (storageSrc) {
    return { src: storageSrc, srcKind: "storage", resizeStep: "storage_direct" };
  }

  const dataSrc = getExchangePhotoUploadSrc(photo);

  if (dataSrc) {
    const prepared = await prepareExchangeUploadDataUrl(dataSrc);
    return { src: prepared.src, srcKind: "data", resizeStep: prepared.resizeStep };
  }

  return {
    src: null,
    srcKind: getTracePhotoSrcKind(photo.src),
    resizeStep: "none",
  };
}

function getExchangePhotoStorageSrc(photo: OwnSleepingPhoto) {
  return (
    [
      photo.src,
      photo.displaySrc,
      photo.thumbnailSrc,
      photo.originalSrc,
    ].find((src): src is string => Boolean(src && isStoragePhotoReference(src))) ??
    null
  );
}

async function prepareExchangeUploadDataUrl(dataUrl: string): Promise<{
  src: string | null;
  resizeStep: ExchangeUploadResizeStep;
}> {
  if (!dataUrl.startsWith("data:image/")) {
    return { src: null, resizeStep: "data_unusable" };
  }

  const attempts: {
    maxSize: number;
    quality: number;
    resizeStep: ExchangeUploadResizeStep;
  }[] = [
    { maxSize: 420, quality: 0.58, resizeStep: "data_resize_420_0.58" },
    { maxSize: 320, quality: 0.52, resizeStep: "data_resize_320_0.52" },
    { maxSize: 240, quality: 0.46, resizeStep: "data_resize_240_0.46" },
    { maxSize: 180, quality: 0.4, resizeStep: "data_resize_180_0.4" },
  ];

  for (const attempt of attempts) {
    const candidate = await resizeDataUrl(dataUrl, attempt.maxSize, attempt.quality);
    if (
      candidate &&
      isDeliverableDataPhotoSrc(candidate) &&
      candidate.length <= EXCHANGE_UPLOAD_MAX_DATA_URL_LENGTH
    ) {
      return { src: candidate, resizeStep: attempt.resizeStep };
    }
  }

  if (
    isDeliverableDataPhotoSrc(dataUrl) &&
    dataUrl.length <= EXCHANGE_UPLOAD_MAX_DATA_URL_LENGTH
  ) {
    return { src: dataUrl, resizeStep: "data_original" };
  }

  return { src: null, resizeStep: "data_unusable" };
}

function getTracePhotoSrcKind(src: string | null | undefined) {
  if (!src) return "empty" as const;
  if (src.startsWith("data:image/")) return "data" as const;
  if (src.startsWith("storage:") || src.startsWith("storage://")) {
    return "storage" as const;
  }
  if (src.startsWith("http://") || src.startsWith("https://")) return "http" as const;
  return "other" as const;
}

function isStoragePhotoReference(src: string | null | undefined) {
  return Boolean(src?.startsWith("storage:") || src?.startsWith("storage://"));
}

function resizeDataUrl(
  src: string,
  maxSize = 420,
  quality = 0.62,
): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(null);
      }
    };

    image.onerror = () => {
      resolve(null);
    };

    image.src = src;
  });
}
