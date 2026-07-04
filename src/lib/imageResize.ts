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

async function decodeImageFileForCanvas(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
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

  throw new Error("image_decode_failed: all decoders failed");
}

async function createBitmapFromFile(file: File) {
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

async function loadImageElementFromObjectUrl(file: File) {
  const url = URL.createObjectURL(file);

  return loadImageElement(url, () => URL.revokeObjectURL(url));
}

async function loadImageElementFromDataUrl(file: File) {
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

function readFileAsDataUrl(file: File) {
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
