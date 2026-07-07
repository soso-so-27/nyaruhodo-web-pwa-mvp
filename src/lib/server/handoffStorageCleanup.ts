import type { SupabaseClient } from "@supabase/supabase-js";

import { CAT_PHOTOS_BUCKET, sanitizePathSegment } from "../photoStorage";

const STORAGE_LIST_LIMIT = 100;

export async function removeHandoffStorageObjects(
  supabase: SupabaseClient,
  token: string,
) {
  const folder = `handoffs/${sanitizePathSegment(token)}`;
  let removedCount = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(CAT_PHOTOS_BUCKET)
      .list(folder, {
        limit: STORAGE_LIST_LIMIT,
        offset: 0,
      });

    if (error) {
      throw new Error(`handoff_storage_list_failed:${error.message}`);
    }

    const items = data ?? [];
    const paths = items
      .filter((item) => item.name && item.name !== ".emptyFolderPlaceholder")
      .map((item) => `${folder}/${item.name}`);

    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .remove(paths);

      if (removeError) {
        throw new Error(`handoff_storage_remove_failed:${removeError.message}`);
      }

      removedCount += paths.length;
    }

    if (items.length < STORAGE_LIST_LIMIT) {
      break;
    }
  }

  return removedCount;
}
