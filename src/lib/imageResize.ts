export async function resizeImageFileToDataUrl(
  file: File,
  maxSize = 1100,
  quality = 0.78,
  mimeType = "image/jpeg",
) {
  const decoded = await decodeImageFileForCanvas(file);
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

const IMAGE_DECODE_RETRY_DELAYS_MS = [0, 220, 650, 1200] as const;
const failedImageDecodeBlobs = new WeakSet<Blob>();
const decodedJpegFallbacks = new WeakMap<
  Blob,
  { canvas: HTMLCanvasElement; width: number; height: number }
>();

async function decodeImageFileForCanvas(file: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  const cachedJpegFallback = readCachedJpegFallback(file);
  if (cachedJpegFallback) {
    return cachedJpegFallback;
  }

  if (failedImageDecodeBlobs.has(file)) {
    throw new Error("image_decode_failed: all decoders failed");
  }

  for (const delayMs of IMAGE_DECODE_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await waitForDecodeRetry(delayMs);
    }

    const stableBlob = await copyImageBlobForDecode(file);
    const decoded = await tryDecodeImageFileForCanvas(stableBlob);

    if (decoded) {
      return decoded;
    }
  }

  const jpegFallback = await decodeJpegWithoutBrowserImageDecoder(file);
  if (jpegFallback) {
    return jpegFallback;
  }

  failedImageDecodeBlobs.add(file);
  throw new Error("image_decode_failed: all decoders failed");
}

async function copyImageBlobForDecode(file: Blob) {
  if (typeof file.arrayBuffer !== "function") {
    return file;
  }

  try {
    const bytes = await file.arrayBuffer();

    return bytes.byteLength > 0
      ? new Blob([bytes], { type: inferImageMimeType(file, bytes) })
      : file;
  } catch {
    return file;
  }
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

async function tryDecodeImageFileForCanvas(file: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
} | null> {
  const bitmap = await createBitmapFromFile(file);

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

async function createBitmapFromFile(file: Blob) {
  if (typeof createImageBitmap !== "function") {
    return null;
  }

  try {
    return await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
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
