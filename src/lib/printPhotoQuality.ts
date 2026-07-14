export const PRINT_PHOTO_PRODUCTS = {
  l: { widthMm: 89, heightMm: 127 },
  postcard: { widthMm: 100, heightMm: 148 },
  twoL: { widthMm: 127, heightMm: 178 },
  a4: { widthMm: 210, heightMm: 297 },
} as const;

export type PrintPhotoProduct = keyof typeof PRINT_PHOTO_PRODUCTS;
export type PrintPhotoQualityStatus =
  | "ready"
  | "acceptable"
  | "warning"
  | "insufficient";

export function assessPrintPhotoQuality({
  pixelWidth,
  pixelHeight,
  product,
}: {
  pixelWidth: number;
  pixelHeight: number;
  product: PrintPhotoProduct;
}) {
  const dimensions = PRINT_PHOTO_PRODUCTS[product];
  const isLandscape = pixelWidth > pixelHeight;
  const printWidthMm = isLandscape ? dimensions.heightMm : dimensions.widthMm;
  const printHeightMm = isLandscape ? dimensions.widthMm : dimensions.heightMm;
  const targetAspect = printWidthMm / printHeightMm;
  const sourceAspect = pixelWidth / pixelHeight;
  const usedPixelWidth =
    sourceAspect > targetAspect ? pixelHeight * targetAspect : pixelWidth;
  const usedPixelHeight =
    sourceAspect > targetAspect ? pixelHeight : pixelWidth / targetAspect;
  const effectiveDpi = Math.floor(
    Math.min(
      usedPixelWidth / (printWidthMm / 25.4),
      usedPixelHeight / (printHeightMm / 25.4),
    ),
  );
  const status: PrintPhotoQualityStatus =
    effectiveDpi >= 300
      ? "ready"
      : effectiveDpi >= 240
        ? "acceptable"
        : effectiveDpi >= 180
          ? "warning"
          : "insufficient";

  return {
    effectiveDpi,
    minimumPixelWidthAt300Dpi: Math.ceil((printWidthMm / 25.4) * 300),
    minimumPixelHeightAt300Dpi: Math.ceil((printHeightMm / 25.4) * 300),
    status,
    usedPixelWidth: Math.floor(usedPixelWidth),
    usedPixelHeight: Math.floor(usedPixelHeight),
  };
}
