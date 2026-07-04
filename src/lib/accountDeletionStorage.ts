import {
  getStoragePhotoPath,
  toStoragePhotoUrl,
} from "./photoStorage";
import { getStoragePhotoUrlVariants } from "./photoStorageAuthorization";

export const PRESERVED_DELIVERY_STATUSES = [
  "delivered",
  "kept",
  "dismissed",
] as const;

export const DELIVERY_ARCHIVE_STORAGE_PREFIX = "delivery-archive";

export type PreservedDeliveryStatus = (typeof PRESERVED_DELIVERY_STATUSES)[number];

export type DeliveryStorageReference = {
  photo_url: string;
  status: string | null;
};

export type DeliveryStorageCopyPlan = {
  archivePath: string;
  sourcePath: string;
  sourceUrlVariants: string[];
  targetPhotoUrl: string;
};

export type AccountStorageDeletionPlan = {
  copies: DeliveryStorageCopyPlan[];
  deletablePaths: string[];
  protectedSourcePaths: string[];
};

export function buildAccountStorageDeletionPlan({
  archivePathForSource,
  deliveryRows,
  ownerPrefix,
  storagePaths,
}: {
  archivePathForSource: (sourcePath: string) => string;
  deliveryRows: DeliveryStorageReference[];
  ownerPrefix: string;
  storagePaths: string[];
}): AccountStorageDeletionPlan {
  const normalizedPrefix = normalizeStoragePrefix(ownerPrefix);
  const protectedSourcePaths = Array.from(
    new Set(
      deliveryRows
        .filter((row) => isPreservedDeliveryStatus(row.status))
        .map((row) => getStoragePhotoPath(row.photo_url))
        .filter((path): path is string => {
          return path !== null && isPathUnderPrefix(path, normalizedPrefix);
        }),
    ),
  ).sort();
  const protectedSet = new Set(protectedSourcePaths);

  return {
    copies: protectedSourcePaths.map((sourcePath) => {
      const archivePath = archivePathForSource(sourcePath);

      return {
        archivePath,
        sourcePath,
        sourceUrlVariants: getStoragePhotoUrlVariants(sourcePath),
        targetPhotoUrl: toStoragePhotoUrl(archivePath),
      };
    }),
    deletablePaths: storagePaths
      .filter((path) => isPathUnderPrefix(path, normalizedPrefix))
      .filter((path) => !protectedSet.has(path))
      .sort(),
    protectedSourcePaths,
  };
}

export function getArchivedDeliveryStoragePath(sourcePath: string, id: string) {
  const extension = readPathExtension(sourcePath);

  return `${DELIVERY_ARCHIVE_STORAGE_PREFIX}/${id}${extension}`;
}

export function isPreservedDeliveryStatus(
  status: string | null,
): status is PreservedDeliveryStatus {
  return PRESERVED_DELIVERY_STATUSES.includes(status as PreservedDeliveryStatus);
}

export function isPathUnderPrefix(path: string, prefix: string) {
  const normalizedPrefix = normalizeStoragePrefix(prefix);

  return path === normalizedPrefix || path.startsWith(`${normalizedPrefix}/`);
}

function normalizeStoragePrefix(prefix: string) {
  return prefix.replace(/^\/+|\/+$/g, "");
}

function readPathExtension(path: string) {
  const match = path.match(/\.([a-zA-Z0-9]+)$/);

  return match ? `.${match[1].toLowerCase()}` : "";
}
