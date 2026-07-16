"use client";

import { useEffect } from "react";
import {
  dispatchBoxPhotoStorageEvent,
  readAllKeptExchangePhotos,
  readAllOwnSleepingPhotos,
} from "../../lib/home/sleepingPhotos";
import {
  getPhotoHistoryLedgerGeneration,
  hydratePhotoHistoryLedger,
  upsertPhotoHistoryEntries,
} from "../../lib/photoHistoryLedger";
import {
  getCollectionPhotoLedgerGeneration,
  hydrateCollectionPhotoLedger,
  migrateLegacyCollectionPhotoStoreForGeneration,
} from "../../lib/collection/photoHistoryLedger";
import { readCatGalleryPhotos } from "../../lib/cats/catGalleryPhotos";
import { STORAGE_KEYS, readCachedJson } from "../../lib/storage";

export function PhotoHistoryLedgerController() {
  useEffect(() => {
    if (isOnboardingResetLocation()) {
      return;
    }

    let isActive = true;
    const photoLedgerGeneration = getPhotoHistoryLedgerGeneration();
    const collectionLedgerGeneration = getCollectionPhotoLedgerGeneration();

    void Promise.all([
      hydratePhotoHistoryLedger(photoLedgerGeneration),
      hydrateCollectionPhotoLedger(collectionLedgerGeneration),
    ])
      .then(() => {
        if (!isActive) {
          return;
        }

        return Promise.all([
          upsertPhotoHistoryEntries("own", readAllOwnSleepingPhotos(), {
            expectedGeneration: photoLedgerGeneration,
          }),
          upsertPhotoHistoryEntries("kept", readAllKeptExchangePhotos(), {
            expectedGeneration: photoLedgerGeneration,
          }),
          upsertPhotoHistoryEntries("gallery", readCatGalleryPhotos(null), {
            expectedGeneration: photoLedgerGeneration,
          }),
          migrateLegacyCollectionPhotoStoreForGeneration(
            readCachedJson<unknown>(STORAGE_KEYS.collectionPhotos),
            collectionLedgerGeneration,
          ),
        ]);
      })
      .then(() => {
        if (isActive) {
          dispatchBoxPhotoStorageEvent();
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

  return null;
}

function isOnboardingResetLocation() {
  const params = new URLSearchParams(window.location.search);
  const reset = params.get("reset_onboarding") ?? params.get("reset");
  return reset === "1" || reset === "true";
}
