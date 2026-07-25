import { backupOwnSleepingPhotoMoment } from "./sleepingPhotoBackup";
import {
  readOwnSleepingPhotosForAlbum,
  updateOwnSleepingPhotoDelivery,
  type OwnSleepingPhoto,
} from "./sleepingPhotos";

export type OwnPhotoSharingError =
  | "photo_not_found"
  | "local_share_update_failed"
  | "share_backup_failed_restored"
  | "share_backup_failed_uncertain"
  | "private_backup_failed"
  | "local_private_update_failed";

export type OwnPhotoSharingResult = {
  photo: OwnSleepingPhoto | null;
  confirmed: boolean;
  error: OwnPhotoSharingError | null;
};

export async function persistOwnPhotoSharing(
  photoId: string,
  nextShared: boolean,
  fallbackPhoto?: OwnSleepingPhoto,
): Promise<OwnPhotoSharingResult> {
  const storedPhoto = readOwnSleepingPhotosForAlbum().find(
    (candidate) =>
      candidate.id === photoId || candidate.sourceMomentId === photoId,
  );
  const currentPhoto = storedPhoto ?? fallbackPhoto;

  if (!currentPhoto) {
    return {
      photo: null,
      confirmed: false,
      error: "photo_not_found",
    };
  }

  if (nextShared) {
    return shareOwnPhoto(currentPhoto, Boolean(storedPhoto));
  }

  return makeOwnPhotoPrivate(currentPhoto, Boolean(storedPhoto));
}

async function shareOwnPhoto(
  currentPhoto: OwnSleepingPhoto,
  isStoredLocally: boolean,
): Promise<OwnPhotoSharingResult> {
  if (!isStoredLocally) {
    const sharedPhoto: OwnSleepingPhoto = {
      ...currentPhoto,
      shared: true,
      visibility: "shared",
    };
    const backupResult = await backupOwnSleepingPhotoMoment(sharedPhoto);

    if (backupResult.ok) {
      return {
        photo: sharedPhoto,
        confirmed: true,
        error: null,
      };
    }

    const previousShared =
      currentPhoto.shared ?? currentPhoto.visibility === "shared";
    const previousPhoto: OwnSleepingPhoto = {
      ...currentPhoto,
      shared: previousShared,
      visibility: previousShared ? "shared" : "private",
    };
    const compensationResult =
      await backupOwnSleepingPhotoMoment(previousPhoto);

    return compensationResult.ok
      ? {
          photo: previousPhoto,
          confirmed: false,
          error: "share_backup_failed_restored",
        }
      : {
          photo: sharedPhoto,
          confirmed: false,
          error: "share_backup_failed_uncertain",
        };
  }

  const updatedPhoto = updateOwnSleepingPhotoDelivery(currentPhoto.id, true);

  if (!updatedPhoto) {
    return {
      photo: currentPhoto,
      confirmed: false,
      error: "local_share_update_failed",
    };
  }

  const backupResult = await backupOwnSleepingPhotoMoment(updatedPhoto);

  if (backupResult.ok) {
    return {
      photo: updatedPhoto,
      confirmed: true,
      error: null,
    };
  }

  const previousShared =
    currentPhoto.shared ?? currentPhoto.visibility === "shared";
  const previousPhoto: OwnSleepingPhoto = {
    ...currentPhoto,
    shared: previousShared,
    visibility: previousShared ? "shared" : "private",
  };
  const compensationResult = await backupOwnSleepingPhotoMoment(previousPhoto);
  const restoredPhoto = compensationResult.ok
    ? updateOwnSleepingPhotoDelivery(currentPhoto.id, previousShared)
    : null;

  if (restoredPhoto) {
    return {
      photo: restoredPhoto,
      confirmed: false,
      error: "share_backup_failed_restored",
    };
  }

  return {
    photo: updatedPhoto,
    confirmed: false,
    error: "share_backup_failed_uncertain",
  };
}

async function makeOwnPhotoPrivate(
  currentPhoto: OwnSleepingPhoto,
  isStoredLocally: boolean,
): Promise<OwnPhotoSharingResult> {
  const privatePhoto: OwnSleepingPhoto = {
    ...currentPhoto,
    shared: false,
    visibility: "private",
  };
  const backupResult = await backupOwnSleepingPhotoMoment(privatePhoto);

  if (!backupResult.ok) {
    return {
      photo: currentPhoto,
      confirmed: false,
      error: "private_backup_failed",
    };
  }

  if (!isStoredLocally) {
    return {
      photo: privatePhoto,
      confirmed: true,
      error: null,
    };
  }

  const updatedPhoto = updateOwnSleepingPhotoDelivery(currentPhoto.id, false);

  if (!updatedPhoto) {
    return {
      photo: privatePhoto,
      confirmed: false,
      error: "local_private_update_failed",
    };
  }

  return {
    photo: updatedPhoto,
    confirmed: true,
    error: null,
  };
}
