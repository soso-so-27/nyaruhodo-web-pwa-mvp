export const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024;

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/x-png",
]);
const SUPPORTED_IMAGE_EXTENSION_PATTERN =
  /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i;

export type ImageFileRejectionReason =
  | "missing_file"
  | "empty_file"
  | "file_too_large"
  | "unsupported_file_type";

export type ImageFileValidationResult =
  | {
      ok: true;
      acceptedBy: "mime" | "extension";
    }
  | {
      ok: false;
      reason: ImageFileRejectionReason;
    };

type ImageFileMetadata = Pick<File, "name" | "size" | "type">;

export function validateImageFile(
  file: ImageFileMetadata | null | undefined,
): ImageFileValidationResult {
  if (!file) {
    return { ok: false, reason: "missing_file" };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, reason: "empty_file" };
  }

  if (file.size > MAX_IMAGE_FILE_BYTES) {
    return { ok: false, reason: "file_too_large" };
  }

  const mimeType = normalizeMimeType(file.type);
  if (SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    return { ok: true, acceptedBy: "mime" };
  }

  // Embedded browsers can expose a valid photo with a generic MIME type.
  // The browser decoder remains the final content check.
  if (SUPPORTED_IMAGE_EXTENSION_PATTERN.test(file.name)) {
    return { ok: true, acceptedBy: "extension" };
  }

  return { ok: false, reason: "unsupported_file_type" };
}

export function isSupportedImageFile(file: ImageFileMetadata) {
  return validateImageFile(file).ok;
}

export function assertSupportedImageFile(file: ImageFileMetadata) {
  const validation = validateImageFile(file);

  if (validation.ok) {
    return;
  }

  switch (validation.reason) {
    case "empty_file":
      throw new Error("Image file is empty");
    case "file_too_large":
      throw new Error("Image file is too large");
    case "missing_file":
      throw new Error("Image file is missing");
    default:
      throw new Error("Unsupported image file type");
  }
}

function normalizeMimeType(type: string) {
  return type.trim().toLowerCase().split(";", 1)[0] ?? "";
}
