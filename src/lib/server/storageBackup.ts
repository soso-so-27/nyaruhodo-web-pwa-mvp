import type { SupabaseClient } from "@supabase/supabase-js";

import { CAT_PHOTOS_BUCKET } from "../photoStorage";

export const CAT_PHOTOS_BACKUP_BUCKET = "cat-photos-backup";

type StorageObject = {
  path: string;
  updatedAt: string | null;
  size: number | null;
  contentType: string | null;
};

export type StorageBackupResult = {
  scanned: number;
  copied: number;
  skipped: number;
  failed: number;
  bucketCreated: boolean;
};

export async function runCatPhotosBackup(
  supabase: SupabaseClient,
): Promise<StorageBackupResult> {
  const bucketCreated = await ensurePrivateBackupBucket(supabase);
  const [sourceObjects, backupObjects] = await Promise.all([
    listAllObjects(supabase, CAT_PHOTOS_BUCKET),
    listAllObjects(supabase, CAT_PHOTOS_BACKUP_BUCKET),
  ]);
  const backupsByPath = new Map(
    backupObjects.map((object) => [object.path, object]),
  );
  const result: StorageBackupResult = {
    scanned: sourceObjects.length,
    copied: 0,
    skipped: 0,
    failed: 0,
    bucketCreated,
  };

  for (const source of sourceObjects) {
    const backup = backupsByPath.get(source.path);
    if (backup && isCurrentBackup(source, backup)) {
      result.skipped += 1;
      continue;
    }

    try {
      if (backup) {
        await replaceBackupObject(supabase, source);
      } else {
        const { error } = await supabase.storage
          .from(CAT_PHOTOS_BUCKET)
          .copy(source.path, source.path, {
            destinationBucket: CAT_PHOTOS_BACKUP_BUCKET,
          });
        if (error) {
          throw error;
        }
      }
      result.copied += 1;
    } catch (error) {
      result.failed += 1;
      console.warn("[admin/storage-backup] object copy failed", {
        path: source.path,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return result;
}

async function ensurePrivateBackupBucket(supabase: SupabaseClient) {
  const { data: bucket, error: lookupError } = await supabase.storage.getBucket(
    CAT_PHOTOS_BACKUP_BUCKET,
  );
  if (!lookupError && bucket) {
    if (bucket.public) {
      const { error } = await supabase.storage.updateBucket(
        CAT_PHOTOS_BACKUP_BUCKET,
        { public: false },
      );
      if (error) {
        throw new Error(`backup bucket privacy update failed: ${error.message}`);
      }
    }
    return false;
  }

  const { error } = await supabase.storage.createBucket(
    CAT_PHOTOS_BACKUP_BUCKET,
    { public: false },
  );
  if (error) {
    throw new Error(`backup bucket creation failed: ${error.message}`);
  }
  return true;
}

async function listAllObjects(
  supabase: SupabaseClient,
  bucket: string,
  prefix = "",
): Promise<StorageObject[]> {
  const objects: StorageObject[] = [];
  const pageSize = 1_000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new Error(`storage list failed (${bucket}/${prefix}): ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      const path = prefix ? `${prefix}/${row.name}` : row.name;
      if (row.id === null) {
        objects.push(...(await listAllObjects(supabase, bucket, path)));
        continue;
      }
      objects.push({
        path,
        updatedAt: row.updated_at,
        size: readMetadataNumber(row.metadata, "size"),
        contentType: readMetadataString(row.metadata, "mimetype"),
      });
    }

    if (rows.length < pageSize) {
      break;
    }
  }

  return objects;
}

function isCurrentBackup(source: StorageObject, backup: StorageObject) {
  if (source.size !== backup.size) {
    return false;
  }
  if (!source.updatedAt || !backup.updatedAt) {
    return false;
  }
  return Date.parse(backup.updatedAt) >= Date.parse(source.updatedAt);
}

async function replaceBackupObject(
  supabase: SupabaseClient,
  source: StorageObject,
) {
  const { data, error: downloadError } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .download(source.path);
  if (downloadError || !data) {
    throw new Error(downloadError?.message ?? "source download returned no data");
  }

  const { error: uploadError } = await supabase.storage
    .from(CAT_PHOTOS_BACKUP_BUCKET)
    .upload(source.path, data, {
      upsert: true,
      ...(source.contentType ? { contentType: source.contentType } : {}),
    });
  if (uploadError) {
    throw uploadError;
  }
}

function readMetadataNumber(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}

function readMetadataString(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}
