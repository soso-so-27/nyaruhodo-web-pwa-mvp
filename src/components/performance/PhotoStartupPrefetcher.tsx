"use client";

import { useEffect } from "react";

import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { readCatGalleryPhotos } from "../../lib/cats/catGalleryPhotos";
import {
  readKeptExchangePhotos,
  readOwnSleepingPhotosForAlbum,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import { resolvePhotoSrc, type PhotoSourceSet } from "../../lib/photoSources";
import { isUsablePhotoSrc } from "../../lib/photoStorage";
import { STORAGE_KEYS } from "../../lib/storage";
import { prefetchStoragePhotoImages } from "../ui/StoredPhotoImage";

const PREFETCH_LIMIT_PER_BUCKET = 6;
const STARTUP_PREFETCH_DELAY_MS = 200;

export function PhotoStartupPrefetcher() {
  useEffect(() => {
    if (shouldSkipStartupPrefetch()) {
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (isCancelled) {
        return;
      }

      void prefetchStartupPhotos();
    }, STARTUP_PREFETCH_DELAY_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}

async function prefetchStartupPhotos() {
  const startedAt = performance.now();
  const activeCatId = readActiveCatId();
  const sentSources = readOwnSleepingPhotosForAlbum(activeCatId)
    .slice(0, PREFETCH_LIMIT_PER_BUCKET)
    .map(getLargePhotoSource)
    .filter(isUsablePhotoSrc);
  const deliveredSources = readKeptExchangePhotos()
    .slice(0, PREFETCH_LIMIT_PER_BUCKET)
    .map(getLargePhotoSource)
    .filter(isUsablePhotoSrc);
  const catGallerySources = readCatGalleryPhotos(activeCatId)
    .slice(0, PREFETCH_LIMIT_PER_BUCKET)
    .map(getLargePhotoSource)
    .filter(isUsablePhotoSrc);

  const thumbnailSources = [...sentSources, ...deliveredSources, ...catGallerySources];
  if (thumbnailSources.length === 0) {
    return;
  }

  try {
    const result = await prefetchStoragePhotoImages(thumbnailSources, "thumbnail");
    trackProductEvent("photo_prefetch_done", {
      route: window.location.pathname,
      attempted_count: result.attemptedCount,
      fetched_count: result.fetchedCount,
      duration_ms: Math.round(performance.now() - startedAt),
      sent_count: sentSources.length,
      delivered_count: deliveredSources.length,
      cat_gallery_count: catGallerySources.length,
    });
  } catch {
    trackProductEvent("photo_prefetch_failed", {
      route: window.location.pathname,
      attempted_count: thumbnailSources.length,
      duration_ms: Math.round(performance.now() - startedAt),
    });
  }
}

function getLargePhotoSource(photo: PhotoSourceSet) {
  return resolvePhotoSrc(photo, "board");
}

function readActiveCatId() {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.activeCatId);
  } catch {
    return null;
  }
}

function shouldSkipStartupPrefetch() {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean };
    }
  ).connection;

  return Boolean(connection?.saveData);
}
