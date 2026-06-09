"use client";

import {
  getDataUrlExtension,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadBlob,
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

export async function storeAccountPhotoFile({
  file,
  pathSegments,
  fileName,
}: {
  file: File;
  pathSegments: string[];
  fileName: string;
}) {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;

    if (!userId) {
      return null;
    }

    const storagePath = await uploadBlob(
      supabase,
      [
        sanitizePathSegment(userId),
        ...pathSegments.map(sanitizePathSegment),
        `${sanitizePathSegment(fileName)}.${getFileExtension(file)}`,
      ].join("/"),
      file,
      file.type || "application/octet-stream",
    );

    return toStoragePhotoUrl(storagePath);
  } catch {
    return null;
  }
}

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension && /^[a-z0-9]{2,8}$/.test(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }

  if (file.type === "image/png") {
    return "png";
  }
  if (file.type === "image/webp") {
    return "webp";
  }
  if (file.type === "image/heic" || file.type === "image/heif") {
    return "heic";
  }

  return "jpg";
}
