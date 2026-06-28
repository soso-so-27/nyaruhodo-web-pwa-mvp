"use client";

import {
  getDataUrlExtension,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "./photoStorage";
import { createBrowserSupabaseClient } from "./supabase/browser";

export async function storeAccountPhotoDataUrl({
  dataUrl,
  pathSegments,
  fileName,
}: {
  dataUrl: string;
  pathSegments: string[];
  fileName: string;
}) {
  if (!dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return dataUrl;
  }

  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;

    if (!userId) {
      return dataUrl;
    }

    const storagePath = await uploadDataUrl(
      supabase,
      [
        sanitizePathSegment(userId),
        ...pathSegments.map(sanitizePathSegment),
        `${sanitizePathSegment(fileName)}.${getDataUrlExtension(dataUrl)}`,
      ].join("/"),
      dataUrl,
    );

    return toStoragePhotoUrl(storagePath);
  } catch {
    return dataUrl;
  }
}
