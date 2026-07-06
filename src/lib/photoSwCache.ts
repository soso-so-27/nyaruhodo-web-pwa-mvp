import { getStoragePhotoPath } from "./photoStorage";

export type PhotoSwCachePurgeReason =
  | "own_photo_deleted"
  | "cat_gallery_photo_deleted"
  | "reported_hidden"
  | "logout"
  | "account_deleted"
  | "account_switch"
  | "feature_disabled";

type PhotoCacheMessage =
  | {
      type: "NN_PHOTO_CACHE_PURGE";
      paths: string[];
      reason: PhotoSwCachePurgeReason;
      variants?: string[];
    }
  | {
      type: "NN_PHOTO_CACHE_PURGE_ALL";
      reason: PhotoSwCachePurgeReason;
    };

export function purgePhotoSwCacheForSources(
  sources: Array<string | null | undefined>,
  reason: PhotoSwCachePurgeReason,
) {
  const paths = Array.from(
    new Set(
      sources
        .filter((source): source is string => typeof source === "string")
        .map((source) => getStoragePhotoPath(source))
        .filter((path): path is string => Boolean(path)),
    ),
  );

  if (paths.length === 0) {
    return;
  }

  postPhotoCacheMessage({
    type: "NN_PHOTO_CACHE_PURGE",
    paths,
    reason,
  });
}

export function purgeAllPhotoSwCache(reason: PhotoSwCachePurgeReason) {
  postPhotoCacheMessage({
    type: "NN_PHOTO_CACHE_PURGE_ALL",
    reason,
  });
}

function postPhotoCacheMessage(message: PhotoCacheMessage) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const controller = navigator.serviceWorker.controller;
  if (controller) {
    controller.postMessage(message);
  }

  void navigator.serviceWorker.ready
    .then((registration) => {
      const active = registration.active;
      if (active && active !== controller) {
        active.postMessage(message);
      }
    })
    .catch(() => null);
}
