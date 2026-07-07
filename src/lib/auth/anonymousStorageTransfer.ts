import { sanitizePathSegment } from "../photoStorage";
import { isSafeStoragePath } from "../photoStorageAuthorization";

export const ANONYMOUS_STORAGE_TRANSFER_TTL_MS = 15 * 60 * 1000;
export const MAX_ANONYMOUS_STORAGE_TRANSFER_PATHS = 160;

export type AnonymousStorageTransferIntentRow = {
  anonymous_user_id: string;
  expires_at: string;
  mappings: unknown;
  paths: unknown;
  target_user_id: string | null;
  transfer_token: string;
  used_at: string | null;
};

export function normalizeAnonymousTransferPaths({
  allowedPaths,
  fromUserId,
  paths,
}: {
  allowedPaths?: string[];
  fromUserId: string;
  paths: unknown[];
}) {
  const allowedPathSet = allowedPaths ? new Set(allowedPaths) : null;
  const uniquePaths = Array.from(
    new Set(paths.filter((path): path is string => typeof path === "string")),
  );

  if (uniquePaths.length > MAX_ANONYMOUS_STORAGE_TRANSFER_PATHS) {
    return { error: "too_many_paths" as const, paths: [] };
  }

  const normalizedPaths = uniquePaths.filter(
    (path) =>
      isAnonymousSourceStoragePath(path, fromUserId) &&
      (!allowedPathSet || allowedPathSet.has(path)),
  );

  if (normalizedPaths.length !== uniquePaths.length) {
    return { error: "invalid_path" as const, paths: [] };
  }

  return { error: null, paths: normalizedPaths };
}

export function isAnonymousSourceStoragePath(path: string, fromUserId: string) {
  return isSafeStoragePath(path) && path.split("/")[0] === fromUserId;
}

export function buildAnonymousTransferTargetPath({
  fromUserId,
  sourcePath,
  targetUserId,
}: {
  fromUserId: string;
  sourcePath: string;
  targetUserId: string;
}) {
  const [, ...restSegments] = sourcePath.split("/");
  const safeRest = restSegments.map(sanitizePathSegment).join("/");

  return [
    targetUserId,
    "anonymous-transfer",
    sanitizePathSegment(fromUserId),
    safeRest || "photo",
  ].join("/");
}

export function isTransferIntentExpired(expiresAt: string, now = Date.now()) {
  return new Date(expiresAt).getTime() <= now;
}

export function getReusableTransferMappings({
  intent,
  targetUserId,
}: {
  intent: Pick<
    AnonymousStorageTransferIntentRow,
    "mappings" | "target_user_id" | "used_at"
  >;
  targetUserId: string;
}) {
  if (!intent.used_at || intent.target_user_id !== targetUserId) {
    return null;
  }

  if (!Array.isArray(intent.mappings)) {
    return null;
  }

  return intent.mappings.filter(
    (mapping): mapping is { from: string; to: string } =>
      typeof mapping === "object" &&
      mapping !== null &&
      typeof (mapping as { from?: unknown }).from === "string" &&
      typeof (mapping as { to?: unknown }).to === "string",
  );
}

export function isAlreadyExistsStorageCopyError(message: string) {
  return /already exists|duplicate|409/i.test(message);
}
