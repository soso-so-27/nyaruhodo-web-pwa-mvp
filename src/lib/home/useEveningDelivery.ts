"use client";

import { useEffect, useRef, useState } from "react";

import { trackProductEvent } from "../analytics/productAnalytics";
import { resolveStoredPhotoUrl } from "../photoStorage";
import { createBrowserSupabaseClient } from "../supabase/browser";
import { createSleepingExchange } from "./deliveryCandidates";
import {
  getJstDateKey,
  getJstDeliveryTime,
  getPendingEveningDeliveryDay,
  readEveningDeliveryStore,
  setAppBadge,
  setEveningDeliveredPhoto,
  type EveningDeliveryDay,
} from "./eveningDelivery";
import { recordEveningDeliveryTrace } from "./eveningDeliveryTrace";
import type { OwnSleepingPhoto } from "./sleepingPhotos";

const EXCHANGE_UPLOAD_MAX_DATA_URL_LENGTH = 500_000;

export function useEveningDelivery({
  activeCatId,
  ownSleepingPhotos,
  tick,
}: {
  activeCatId: string | null;
  ownSleepingPhotos: OwnSleepingPhoto[];
  tick: number;
}) {
  const pendingEveningDeliveryKeysRef = useRef(new Set<string>());
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const now = tick || Date.now();
    const todayKey = getJstDateKey(now);
    const store = readEveningDeliveryStore();
    const todayDay = store[todayKey];
    const pendingDay = getPendingEveningDeliveryDay(now);
    const traceBase = buildEveningDeliveryTraceBase({
      activeCatId,
      now,
      pendingDay,
      todayDay,
      todayKey,
    });

    if (!pendingDay?.targetOwnPhotoId || !activeCatId) {
      if (todayDay && now >= getJstDeliveryTime(todayKey)) {
        recordEveningDeliveryTrace({
          ...traceBase,
          gate: pendingDay ? "missing_target_or_cat" : "no_pending_day",
        });
      }
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
            activeCatId,
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
      return;
    }

    pendingEveningDeliveryKeysRef.current.add(pendingDay.dateKey);
    void (async () => {
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
          exchangePayloadLength: null,
        });
        pendingEveningDeliveryKeysRef.current.delete(pendingDay.dateKey);
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
        recipientCatId: pendingDay.targetCatId ?? activeCatId,
      });

      recordEveningDeliveryTrace({
        ...traceBase,
        gate: "exchange_completed",
        directOwnPhotoFound: Boolean(directOwnPhoto),
        targetPhotoFallbackUsed: Boolean(targetPhoto),
        legacyFallbackUsed: Boolean(legacyPhoto),
        selectedPhotoSource,
        selectedPhotoSrcKind: uploadSrc.srcKind,
        exchangePayloadLength: uploadSrc.src.length,
        exchangeElapsedMs: Date.now() - exchangeStartedAt,
        exchangeCalled: true,
        exchangeStatus: result.httpStatus,
        exchangeError: result.error,
        exchangePhotoReceived: Boolean(result.photo),
      });

      if (!result.photo) {
        pendingEveningDeliveryKeysRef.current.delete(pendingDay.dateKey);
        trackProductEvent(
          "delivery_sent",
          {
            delivery_date_key: pendingDay.dateKey,
            poolSource: "none",
            isOnboardingInstant: false,
            isDay1Evening: false,
          },
          { localCatId: pendingDay.targetCatId ?? activeCatId },
        );
        return;
      }

      setEveningDeliveredPhoto(pendingDay.dateKey, result.photo, Date.now());
      void setAppBadge(1);
      setRefreshToken((value) => value + 1);
      trackProductEvent(
        "delivery_sent",
        {
          delivery_date_key: pendingDay.dateKey,
          poolSource: "normal",
          isOnboardingInstant: false,
          isDay1Evening: false,
        },
        { localCatId: pendingDay.targetCatId ?? activeCatId },
      );
    })();
  }, [activeCatId, ownSleepingPhotos, tick]);

  return { refreshToken };
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
    };
  }

  return {
    photo: result.photo,
    httpStatus: result.httpStatus ?? null,
    error: result.error ?? null,
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

async function resolveExchangePhotoUploadSrc(photo: OwnSleepingPhoto): Promise<{
  src: string | null;
  srcKind: ReturnType<typeof getTracePhotoSrcKind>;
}> {
  const storageSrc = getExchangePhotoStorageSrc(photo);

  if (storageSrc) {
    return { src: storageSrc, srcKind: "storage" };
  }

  const dataSrc = getExchangePhotoUploadSrc(photo);

  if (dataSrc) {
    return { src: await prepareExchangeUploadDataUrl(dataSrc), srcKind: "data" };
  }

  const candidates = [
    photo.src,
    photo.displaySrc,
    photo.thumbnailSrc,
    photo.originalSrc,
  ].filter((src): src is string => Boolean(src));
  const firstKind = getTracePhotoSrcKind(candidates[0]);
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return { src: null, srcKind: firstKind };
  }

  for (const candidate of candidates) {
    if (!isStoragePhotoReference(candidate)) {
      continue;
    }

    const resolved = await resolveStoredPhotoUrl(supabase, candidate).catch(
      () => undefined,
    );

    if (resolved && resolved.startsWith("data:image/")) {
      return {
        src: await prepareExchangeUploadDataUrl(resolved),
        srcKind: "storage",
      };
    }
  }

  return { src: null, srcKind: firstKind };
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

async function prepareExchangeUploadDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith("data:image/")) {
    return null;
  }

  const attempts = [
    await resizeDataUrl(dataUrl, 420, 0.58),
    await resizeDataUrl(dataUrl, 320, 0.52),
    await resizeDataUrl(dataUrl, 240, 0.46),
    await resizeDataUrl(dataUrl, 180, 0.4),
    dataUrl,
  ];

  return (
    attempts.find(
      (candidate): candidate is string =>
        Boolean(
          candidate &&
            isDeliverableDataPhotoSrc(candidate) &&
            candidate.length <= EXCHANGE_UPLOAD_MAX_DATA_URL_LENGTH,
        ),
    ) ?? null
  );
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
