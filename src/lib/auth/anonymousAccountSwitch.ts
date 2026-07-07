"use client";

import {
  CAT_PHOTOS_BUCKET,
  getStoragePhotoPath,
} from "../photoStorage";
import {
  readAllOwnSleepingPhotos,
  writeOwnSleepingPhotosWithFallback,
  type OwnSleepingPhoto,
} from "../home/sleepingPhotos";
import {
  readOnboardingProgress,
  writeOnboardingProgress,
  type OnboardingProgress,
} from "../onboarding/progress";
import { createBrowserSupabaseClient } from "../supabase/browser";

export async function prepareAnonymousStorageRefsForAccountSwitch() {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    return { converted: 0 };
  }

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) {
    return { converted: 0 };
  }

  let converted = 0;
  const ownPhotos = await Promise.all(
    readAllOwnSleepingPhotos().map(async (photo) => {
      const next = await rewriteOwnPhotoStorageRefs(photo, userId);
      converted += next.converted;
      return next.photo;
    }),
  );

  writeOwnSleepingPhotosWithFallback(ownPhotos);

  const progress = readOnboardingProgress();
  if (progress) {
    const nextProgress = await rewriteOnboardingProgress(progress, userId);
    converted += nextProgress.converted;
    writeOnboardingProgress(nextProgress.progress);
  }

  return { converted };
}

async function rewriteOnboardingProgress(
  progress: OnboardingProgress,
  userId: string,
) {
  let converted = 0;
  let ownPhoto = progress.ownPhoto;

  if (ownPhoto) {
    const next = await rewriteOwnPhotoStorageRefs(ownPhoto, userId);
    converted += next.converted;
    ownPhoto = next.photo;
  }

  return {
    converted,
    progress: ownPhoto ? { ...progress, ownPhoto } : progress,
  };
}

async function rewriteOwnPhotoStorageRefs(photo: OwnSleepingPhoto, userId: string) {
  let converted = 0;
  const src = await rewriteOwnStorageRef(photo.src, userId);
  const displaySrc = photo.displaySrc
    ? await rewriteOwnStorageRef(photo.displaySrc, userId)
    : undefined;
  const originalSrc = photo.originalSrc
    ? await rewriteOwnStorageRef(photo.originalSrc, userId)
    : undefined;
  const thumbnailSrc = photo.thumbnailSrc
    ? await rewriteOwnStorageRef(photo.thumbnailSrc, userId)
    : undefined;

  for (const value of [src, displaySrc, originalSrc, thumbnailSrc]) {
    if (value?.converted) {
      converted += 1;
    }
  }

  return {
    converted,
    photo: {
      ...photo,
      src: src.value,
      ...(displaySrc ? { displaySrc: displaySrc.value } : {}),
      ...(originalSrc ? { originalSrc: originalSrc.value } : {}),
      ...(thumbnailSrc ? { thumbnailSrc: thumbnailSrc.value } : {}),
    },
  };
}

async function rewriteOwnStorageRef(value: string, userId: string) {
  const storagePath = getStoragePhotoPath(value);
  if (!storagePath || storagePath.split("/")[0] !== userId) {
    return { value, converted: false };
  }

  const dataUrl = await downloadStoragePathAsDataUrl(storagePath).catch(() => null);
  return dataUrl
    ? { value: dataUrl, converted: true }
    : { value, converted: false };
}

async function downloadStoragePathAsDataUrl(storagePath: string) {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    return null;
  }

  return blobToDataUrl(data);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
