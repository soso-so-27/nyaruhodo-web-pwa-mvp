export async function resizeImageFileToDataUrl(
  file: File,
  maxSize = 1100,
  quality = 0.78,
  mimeType = "image/jpeg",
) {
  const decoded = await decodeImageFileForCanvas(file, maxSize);
  const scale = Math.min(1, maxSize / Math.max(decoded.width, decoded.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(decoded.width * scale));
  canvas.height = Math.max(1, Math.round(decoded.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    decoded.cleanup();
    throw new Error("Canvas context unavailable");
  }

  try {
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL(mimeType, quality);

    return encoded.startsWith(`data:${mimeType};`)
      ? encoded
      : canvas.toDataURL("image/jpeg", quality);
  } finally {
    decoded.cleanup();
  }
}

export async function readImageFileDimensions(file: Blob) {
  const decoded = await decodeImageFileForCanvas(file);

  try {
    return {
      width: decoded.width,
      height: decoded.height,
    };
  } finally {
    decoded.cleanup();
  }
}

const IMAGE_DECODE_RETRY_DELAYS_MS = [0, 200, 500, 900, 1400, 2200] as const;
const decodedJpegFallbacks = new WeakMap<
  Blob,
  { canvas: HTMLCanvasElement; width: number; height: number }
>();
const stableImageBlobs = new WeakMap<Blob, Blob>();
const encodedImageDimensions = new WeakMap<
  Blob,
  { width: number; height: number }
>();

async function decodeImageFileForCanvas(
  file: Blob,
  maxDecodeSize?: number,
): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  const cachedJpegFallback = readCachedJpegFallback(file);
  if (cachedJpegFallback) {
    return cachedJpegFallback;
  }

  let lastStableBlob = file;

  for (const [attemptIndex, delayMs] of IMAGE_DECODE_RETRY_DELAYS_MS.entries()) {
    if (delayMs > 0) {
      await waitForDecodeRetry(delayMs);
    }

    const stableBlob = await copyImageBlobForDecode(file);
    lastStableBlob = stableBlob;
    const decoded = await tryDecodeImageFileForCanvas(
      stableBlob,
      maxDecodeSize,
    );

    if (decoded) {
      return decoded;
    }

    // Android content providers can need a short warm-up before the same File
    // becomes decodable. Try the byte-level JPEG path early, then keep waiting
    // for native decoding instead of making the user select the photo again.
    if (attemptIndex === 2) {
      const jpegFallback = await decodeJpegWithoutBrowserImageDecoder(stableBlob);
      if (jpegFallback) {
        return jpegFallback;
      }
    }
  }

  const jpegFallback = await decodeJpegWithoutBrowserImageDecoder(lastStableBlob);
  if (jpegFallback) {
    return jpegFallback;
  }

  throw new Error(
    `image_decode_failed: all decoders failed; stable_copy=${
      lastStableBlob === file ? "no" : "yes"
    }`,
  );
}

async function copyImageBlobForDecode(file: Blob) {
  const cached = stableImageBlobs.get(file);
  if (cached) {
    return cached;
  }

  const readers = isAndroidLineBrowser()
    ? [readBlobWithFileReader, readBlobWithArrayBuffer, readBlobWithResponse]
    : [readBlobWithArrayBuffer, readBlobWithFileReader, readBlobWithResponse];

  for (const readBytes of readers) {
    try {
      const bytes = await readBytes(file);
      if (!isCompleteBlobRead(file, bytes)) {
        continue;
      }

      const stableBlob = new Blob([bytes], {
        type: inferImageMimeType(file, bytes),
      });
      const dimensions = readEncodedImageDimensions(new Uint8Array(bytes));

      stableImageBlobs.set(file, stableBlob);
      stableImageBlobs.set(stableBlob, stableBlob);
      if (dimensions) {
        encodedImageDimensions.set(file, dimensions);
        encodedImageDimensions.set(stableBlob, dimensions);
      }

      return stableBlob;
    } catch {
      // Try the next browser API. Android WebViews do not always expose a
      // content-provider photo consistently through every Blob reader.
    }
  }

  return file;
}

export function getStableImageFileForPersistence(file: File) {
  const stableBlob = stableImageBlobs.get(file);
  if (!stableBlob || stableBlob === file) {
    return file;
  }

  return new File([stableBlob], file.name || "photo.jpg", {
    type: stableBlob.type || file.type,
    lastModified: file.lastModified,
  });
}

async function readBlobWithArrayBuffer(file: Blob) {
  if (typeof file.arrayBuffer !== "function") {
    throw new Error("Blob.arrayBuffer unavailable");
  }

  return file.arrayBuffer();
}

function readBlobWithFileReader(file: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error("FileReader returned non-buffer result"));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("FileReader failed"));
    };
    reader.onabort = () => {
      reject(new Error("FileReader aborted"));
    };
    reader.readAsArrayBuffer(file);
  });
}

async function readBlobWithResponse(file: Blob) {
  if (typeof Response === "undefined") {
    throw new Error("Response unavailable");
  }

  return new Response(file).arrayBuffer();
}

function isCompleteBlobRead(file: Blob, bytes: ArrayBuffer) {
  if (bytes.byteLength <= 0) {
    return false;
  }

  return file.size <= 0 || bytes.byteLength === file.size;
}

async function decodeJpegWithoutBrowserImageDecoder(file: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
} | null> {
  const cached = readCachedJpegFallback(file);
  if (cached) {
    return cached;
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isJpegBytes(bytes)) {
      return null;
    }

    const { decode } = await import("jpeg-js");
    const decoded = decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      tolerantDecoding: true,
      maxResolutionInMP: 50,
      maxMemoryUsageInMB: 192,
    });
    if (!decoded.width || !decoded.height || !decoded.data.length) {
      return null;
    }

    const rawCanvas = document.createElement("canvas");
    rawCanvas.width = decoded.width;
    rawCanvas.height = decoded.height;
    const context = rawCanvas.getContext("2d");
    if (!context) {
      return null;
    }

    const pixels = new Uint8ClampedArray(decoded.data.byteLength);
    pixels.set(decoded.data);
    context.putImageData(
      new ImageData(pixels, decoded.width, decoded.height),
      0,
      0,
    );

    const canvas = await applyJpegExifOrientation(rawCanvas, bytes);
    if (canvas !== rawCanvas) {
      rawCanvas.width = 1;
      rawCanvas.height = 1;
    }

    decodedJpegFallbacks.set(file, {
      canvas,
      width: canvas.width,
      height: canvas.height,
    });

    return {
      source: canvas,
      width: canvas.width,
      height: canvas.height,
      cleanup: () => {},
    };
  } catch {
    return null;
  }
}

async function applyJpegExifOrientation(
  source: HTMLCanvasElement,
  bytes: Uint8Array,
) {
  try {
    const exifr = (await import("exifr")).default;
    const orientation = await exifr.orientation(bytes);
    const rotation = orientation ? exifr.rotations[orientation] : undefined;
    if (!rotation || orientation === 1) {
      return source;
    }

    const canvas = document.createElement("canvas");
    canvas.width = rotation.dimensionSwapped ? source.height : source.width;
    canvas.height = rotation.dimensionSwapped ? source.width : source.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return source;
    }

    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation.rad);
    context.scale(rotation.scaleX, rotation.scaleY);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    return canvas;
  } catch {
    return source;
  }
}

function readCachedJpegFallback(file: Blob) {
  const cached = decodedJpegFallbacks.get(file);
  if (!cached) {
    return null;
  }

  return {
    source: cached.canvas as CanvasImageSource,
    width: cached.width,
    height: cached.height,
    cleanup: () => {},
  };
}

function inferImageMimeType(file: Blob, bytes: ArrayBuffer) {
  const normalizedType = file.type.trim().toLowerCase().split(";", 1)[0];
  if (normalizedType.startsWith("image/")) {
    return normalizedType;
  }

  const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16));
  if (isJpegBytes(header)) {
    return "image/jpeg";
  }
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    header.length >= 12 &&
    String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...header.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  const fileName = file instanceof File ? file.name.toLowerCase() : "";
  if (/\.jpe?g$/.test(fileName)) {
    return "image/jpeg";
  }
  if (/\.png$/.test(fileName)) {
    return "image/png";
  }
  if (/\.webp$/.test(fileName)) {
    return "image/webp";
  }

  return "application/octet-stream";
}

function isJpegBytes(bytes: Uint8Array) {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

function readEncodedImageDimensions(bytes: Uint8Array) {
  const pngDimensions = readPngDimensions(bytes);
  if (pngDimensions) {
    return pngDimensions;
  }

  return readJpegDimensions(bytes);
}

function readPngDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);

  return width > 0 && height > 0 ? { width, height } : null;
}

function readJpegDimensions(bytes: Uint8Array) {
  if (!isJpegBytes(bytes)) {
    return null;
  }

  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;

  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda || offset + 1 >= bytes.length) {
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      continue;
    }

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      break;
    }

    if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }

    offset += segmentLength;
  }

  return null;
}

async function tryDecodeImageFileForCanvas(
  file: Blob,
  maxDecodeSize?: number,
): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
} | null> {
  const bitmap = await createBitmapFromFile(file, maxDecodeSize);

  if (bitmap) {
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrlImage = await loadImageElementFromObjectUrl(file);

  if (objectUrlImage) {
    return objectUrlImage;
  }

  const dataUrlImage = await loadImageElementFromDataUrl(file);

  if (dataUrlImage) {
    return dataUrlImage;
  }

  return null;
}

async function createBitmapFromFile(file: Blob, maxDecodeSize?: number) {
  if (typeof createImageBitmap !== "function") {
    return null;
  }

  const options = buildImageBitmapOptions(file, maxDecodeSize);
  const hasConstrainedSize = Boolean(options.resizeWidth || options.resizeHeight);

  try {
    return await createImageBitmap(file, options);
  } catch {
    if (hasConstrainedSize) {
      return null;
    }

    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
}

function buildImageBitmapOptions(file: Blob, maxDecodeSize?: number) {
  const options: ImageBitmapOptions = {
    imageOrientation: "from-image",
  };
  if (!maxDecodeSize || !isAndroidLineBrowser()) {
    return options;
  }

  const dimensions = encodedImageDimensions.get(file);
  if (!dimensions || Math.max(dimensions.width, dimensions.height) <= maxDecodeSize) {
    return options;
  }

  if (dimensions.width >= dimensions.height) {
    options.resizeWidth = maxDecodeSize;
  } else {
    options.resizeHeight = maxDecodeSize;
  }
  options.resizeQuality = "high";

  return options;
}

function isAndroidLineBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("android") && userAgent.includes("line/");
}

async function loadImageElementFromObjectUrl(file: Blob) {
  const url = URL.createObjectURL(file);

  return loadImageElement(url, () => URL.revokeObjectURL(url));
}

async function loadImageElementFromDataUrl(file: Blob) {
  try {
    const dataUrl = await readFileAsDataUrl(file);

    return await loadImageElement(dataUrl);
  } catch {
    return null;
  }
}

function loadImageElement(src: string, cleanup: () => void = () => {}) {
  return new Promise<{
    source: HTMLImageElement;
    width: number;
    height: number;
    cleanup: () => void;
  } | null>((resolve) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        cleanup,
      });
    };
    image.onerror = () => {
      cleanup();
      resolve(null);
    };
    image.src = src;
  });
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("FileReader returned non-string result"));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("FileReader failed"));
    };
    reader.readAsDataURL(file);
  });
}

function waitForDecodeRetry(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}
