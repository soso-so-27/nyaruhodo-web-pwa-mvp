"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { trackProductEvent } from "../analytics/productAnalytics";
import { createSleepingExchange } from "./deliveryCandidates";
import {
  getJstDateKey,
  getJstAutoOpenTime,
  getJstDeliveryTime,
  getPendingEveningDeliveryDay,
  readEveningDeliveryStore,
  repairMissingEveningDeliveryTarget,
  setAppBadge,
  setEveningDeliveredPhotos,
  markEveningDeliverySkipped,
  type EveningDeliveryDay,
} from "./eveningDelivery";
import { recordEveningDeliveryTrace } from "./eveningDeliveryTrace";
import type { OwnSleepingPhoto } from "./sleepingPhotos";

const EXCHANGE_UPLOAD_MAX_DATA_URL_LENGTH = 500_000;
const EVENING_DELIVERY_SLOW_MS = 4_000;
const EVENING_DELIVERY_RETRY_DELAYS_MS = [
  1_500,
  5_000,
  30_000,
  120_000,
  300_000,
] as const;

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
  | "automatic_retry"
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
  const automaticRetryCountsRef = useRef(new Map<string, number>());
  const automaticRetryTimersRef = useRef(new Map<string, number>());
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

  const clearAutomaticRetry = useCallback((dateKey: string) => {
    const timerId = automaticRetryTimersRef.current.get(dateKey);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      automaticRetryTimersRef.current.delete(dateKey);
    }
    automaticRetryCountsRef.current.delete(dateKey);
  }, []);

  const scheduleAutomaticRetry = useCallback(
    (dateKey: string) => {
      if (automaticRetryTimersRef.current.has(dateKey)) {
        return;
      }

      const attempt = automaticRetryCountsRef.current.get(dateKey) ?? 0;
      const delay = EVENING_DELIVERY_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        return;
      }

      automaticRetryCountsRef.current.set(dateKey, attempt + 1);
      const timerId = window.setTimeout(() => {
        automaticRetryTimersRef.current.delete(dateKey);
        requestDeliveryCheck("automatic_retry");
      }, delay);
      automaticRetryTimersRef.current.set(dateKey, timerId);
    },
    [requestDeliveryCheck],
  );

  const ensureEveningDelivery = useCallback(
    async (source: EveningDeliveryCheckSource) => {
      const now = Date.now();
      const todayKey = getJstDateKey(now);
      let store = readEveningDeliveryStore();
      let todayDay = store[todayKey];
      let pendingDay = getPendingEveningDeliveryDay(now);

      if (!pendingDay) {
        const repaired = repairMissingEveningDeliveryTarget(
          ownSleepingPhotos,
          now,
        );
        if (repaired) {
          trackProductEvent(
            "evening_delivery_target_repaired",
            {
              delivery_date_key: repaired.dateKey,
              source,
            },
            { localCatId: activeCatId },
          );
          store = readEveningDeliveryStore();
          todayDay = store[todayKey];
          pendingDay = getPendingEveningDeliveryDay(now);
          setRefreshToken((value) => value + 1);
        }
      }
      const recipientCatId = pendingDay?.targetCatId ?? activeCatId;
      const traceBase = buildEveningDeliveryTraceBase({
        activeCatId,
        now,
        pendingDay,
        todayDay,
        todayKey,
      });

      if (
        pendingDay?.targetOwnPhotoId &&
        now >= getJstAutoOpenTime(pendingDay.dateKey)
      ) {
        const expiredAt = getJstAutoOpenTime(pendingDay.dateKey);
        markEveningDeliverySkipped(pendingDay.dateKey, expiredAt);
        clearAutomaticRetry(pendingDay.dateKey);
        setCheckStatus({ state: "idle", dateKey: null });
        setRefreshToken((value) => value + 1);
        trackProductEvent(
          "evening_delivery_choice_expired",
          {
            delivery_date_key: pendingDay.dateKey,
            had_bundle: false,
            expired_at: expiredAt,
            source,
          },
          { localCatId: recipientCatId },
        );
        return;
      }

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
          deliveryDateKey: pendingDay.dateKey,
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
        deliveryDateKey: pendingDay.dateKey,
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
          deliveryDateKey: pendingDay.dateKey,
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
            deliveryDateKey: pendingDay.dateKey,
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
            scheduleAutomaticRetry(pendingDay.dateKey);
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
              deliveryDateKey: pendingDay.dateKey,
            });
            return;
          }
          setCheckStatus({ state: "failed", dateKey: pendingDay.dateKey });
          scheduleAutomaticRetry(pendingDay.dateKey);
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
            deliveryDateKey: pendingDay.dateKey,
          });
          return;
        }

        const deliveredPhotos =
          result.servedVariant === "four_choice_v1" && result.photos.length === 4
            ? result.photos
            : [result.photo];
        const didPersistDelivery = setEveningDeliveredPhotos(
          pendingDay.dateKey,
          deliveredPhotos,
          Date.now(),
          {
            deliveryBundleId: result.bundleId ?? undefined,
            experienceVersion: result.experienceVersion ?? undefined,
            assignedVariant: result.assignedVariant ?? undefined,
            servedVariant: result.servedVariant ?? undefined,
            requestedCount: result.requestedCount,
            servedCount: deliveredPhotos.length,
            fallbackReason: result.fallbackReason ?? null,
          },
        );
        if (!didPersistDelivery) {
          pendingEveningDeliveryKeysRef.current.delete(pendingDay.dateKey);
          setCheckStatus({ state: "failed", dateKey: pendingDay.dateKey });
          scheduleAutomaticRetry(pendingDay.dateKey);
          trackEveningDeliveryCheckEvent("evening_delivery_check_failed", {
            startedAt: checkStartedAt,
            source,
            route,
            deliveryDateKey: pendingDay.dateKey,
          });
          return;
        }
        const persistedDay = readEveningDeliveryStore()[pendingDay.dateKey];
        const persistedServedCount = persistedDay?.deliveredPhotos?.length ??
          (persistedDay?.deliveredPhoto ? 1 : 0);
        const persistedServedVariant =
          persistedDay?.servedVariant ??
          (persistedServedCount === 4 ? "four_choice_v1" : "single_v1");
        const persistedFallbackReason =
          persistedDay?.fallbackReason ?? result.fallbackReason ?? null;
        clearAutomaticRetry(pendingDay.dateKey);
        void setAppBadge(1);
        setRefreshToken((value) => value + 1);
        setCheckStatus({ state: "idle", dateKey: null });
        trackEveningDeliveryCheckEvent("evening_delivery_check_succeeded", {
          startedAt: checkStartedAt,
          source,
          route,
          deliveryDateKey: pendingDay.dateKey,
          deliveryBundleId: result.bundleId,
          experienceVersion: result.experienceVersion,
          assignedVariant: result.assignedVariant,
          servedVariant: persistedServedVariant,
          requestedCount: result.requestedCount,
          servedCount: persistedServedCount,
          fallbackReason: persistedFallbackReason,
        });
        trackProductEvent(
          "delivery_sent",
          {
            delivery_date_key: pendingDay.dateKey,
            poolSource: "normal",
            isOnboardingInstant: false,
            isDay1Evening: false,
            tier: result.tier ?? null,
            delivery_bundle_id: result.bundleId ?? null,
            experience_version: result.experienceVersion ?? null,
            assigned_variant: result.assignedVariant ?? "single_v1",
            served_variant: persistedServedVariant,
            requested_count: result.requestedCount,
            served_count: persistedServedCount,
            fallback_reason: persistedFallbackReason,
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
        scheduleAutomaticRetry(pendingDay.dateKey);
        trackEveningDeliveryCheckEvent("evening_delivery_check_failed", {
          startedAt: checkStartedAt,
          source,
          route,
          deliveryDateKey: pendingDay.dateKey,
        });
      } finally {
        if (slowTimer !== null) {
          window.clearTimeout(slowTimer);
        }
      }
    },
    [
      activeCatId,
      clearAutomaticRetry,
      ownSleepingPhotos,
      scheduleAutomaticRetry,
    ],
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
      for (const timerId of automaticRetryTimersRef.current.values()) {
        window.clearTimeout(timerId);
      }
      automaticRetryTimersRef.current.clear();
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
    deliveryDateKey,
    deliveryBundleId,
    experienceVersion,
    assignedVariant,
    servedVariant,
    requestedCount,
    servedCount,
    fallbackReason,
  }: {
    startedAt: number;
    source: EveningDeliveryCheckSource;
    route: string;
    deliveryDateKey: string;
    deliveryBundleId?: string | null;
    experienceVersion?: string | null;
    assignedVariant?: string | null;
    servedVariant?: string | null;
    requestedCount?: number;
    servedCount?: number;
    fallbackReason?: string | null;
  },
) {
  trackProductEvent(eventName, {
    latency_ms: Math.max(0, Date.now() - startedAt),
    source,
    route,
    delivery_date_key: deliveryDateKey,
    delivery_bundle_id: deliveryBundleId ?? null,
    experience_version: experienceVersion ?? null,
    assigned_variant: assignedVariant ?? null,
    served_variant: servedVariant ?? null,
    requested_count: requestedCount ?? null,
    served_count: servedCount ?? null,
    fallback_reason: fallbackReason ?? null,
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
    requestedCandidateCount: 4,
    capability: "evening_choice_v1",
  });

  if (!result?.photo) {
    return {
      photo: null,
      httpStatus: result?.httpStatus ?? null,
      error: result?.error ?? null,
      tier: null,
      photos: [],
      bundleId: null,
      experienceVersion: null,
      assignedVariant: null,
      servedVariant: null,
      requestedCount: 4,
      servedCount: 0,
      fallbackReason: null,
    };
  }

  const returnedPhotos = (result.photos ?? [])
    .filter((photo) => Boolean(photo?.id && photo.src))
    .filter(
      (photo, index, photos) =>
        photos.findIndex(
          (candidate) =>
            candidate.id === photo.id ||
            Boolean(
              candidate.sourcePhotoId &&
                photo.sourcePhotoId &&
                candidate.sourcePhotoId === photo.sourcePhotoId,
            ),
        ) === index,
    );
  const photos =
    result.servedVariant === "four_choice_v1" && returnedPhotos.length === 4
      ? returnedPhotos
      : [result.photo];

  return {
    photo: result.photo,
    photos,
    httpStatus: result.httpStatus ?? null,
    error: result.error ?? null,
    tier: result.tier ?? null,
    bundleId: result.bundleId ?? null,
    experienceVersion: result.experienceVersion ?? null,
    assignedVariant: result.assignedVariant ?? "single_v1",
    servedVariant:
      result.servedVariant === "four_choice_v1" && photos.length === 4
        ? "four_choice_v1"
        : "single_v1",
    requestedCount: result.requestedCount ?? result.requestedCandidateCount ?? 4,
    servedCount: photos.length,
    fallbackReason: result.fallbackReason ?? null,
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
