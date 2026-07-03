import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const manifestPath = path.join(
  root,
  "public",
  "animations",
  "reference",
  "home-envelope-rive-layers-v2",
  "layer-manifest.json",
);
const keyframesPath = path.join(
  root,
  "public",
  "animations",
  "reference",
  "home-envelope-rive-keyframes-v2.json",
);
const authoringManifestPath = path.join(
  root,
  "public",
  "animations",
  "reference",
  "home-envelope-rive-authoring-manifest.json",
);
const riveConfigPath = path.join(
  root,
  "src",
  "components",
  "home",
  "homeEnvelopeRiveConfig.ts",
);

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function fail(message) {
  console.error(`home envelope Rive asset check failed: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`cannot read ${path.relative(root, filePath)}: ${error.message}`);
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`cannot read ${path.relative(root, filePath)}: ${error.message}`);
  }
}

function readExportedString(source, name) {
  const match = source.match(new RegExp(`export const ${name} = "([^"]+)";`));
  return match?.[1];
}

function readExportedNumber(source, name) {
  const match = source.match(new RegExp(`export const ${name} = ([0-9]+);`));
  return match ? Number(match[1]) : undefined;
}

function paethPredictor(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function parsePng(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(`${path.relative(root, filePath)} is not a PNG`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = bytes.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    fail(
      `${path.relative(root, filePath)} must be 8-bit RGBA PNG; got bitDepth=${bitDepth}, colorType=${colorType}`,
    );
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rows = [];
  let sourceOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const scanline = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + stride));
    sourceOffset += stride;
    const row = Buffer.alloc(stride);

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let value;

      if (filter === 0) value = scanline[x];
      else if (filter === 1) value = scanline[x] + left;
      else if (filter === 2) value = scanline[x] + up;
      else if (filter === 3) value = scanline[x] + Math.floor((left + up) / 2);
      else if (filter === 4) value = scanline[x] + paethPredictor(left, up, upLeft);
      else fail(`${path.relative(root, filePath)} has unsupported PNG filter ${filter}`);

      row[x] = value & 0xff;
    }

    rows.push(row);
    previous = row;
  }

  return { width, height, rows };
}

function analyzePng(filePath) {
  const png = parsePng(filePath);
  let transparentPixels = 0;
  let visiblePixels = 0;
  let greenishVisiblePixels = 0;

  for (const row of png.rows) {
    for (let offset = 0; offset < row.length; offset += 4) {
      const r = row[offset];
      const g = row[offset + 1];
      const b = row[offset + 2];
      const a = row[offset + 3];

      if (a <= 8) {
        transparentPixels += 1;
        continue;
      }

      visiblePixels += 1;
      if (g > 110 && g > r * 1.18 && g > b * 1.18) {
        greenishVisiblePixels += 1;
      }
    }
  }

  return {
    width: png.width,
    height: png.height,
    transparentPixels,
    visiblePixels,
    greenishVisiblePixels,
  };
}

const manifest = readJson(manifestPath);
const keyframes = readJson(keyframesPath);
const authoringManifest = readJson(authoringManifestPath);
const riveConfigSource = readText(riveConfigPath);

if (!Array.isArray(manifest.layers) || manifest.layers.length !== 12) {
  fail("layer-manifest.json must contain exactly 12 layers");
}

if (keyframes.artboard?.name !== "HomeEnvelopeOpen") {
  fail("keyframes artboard must be HomeEnvelopeOpen");
}

if (
  keyframes.stateMachine?.name !== "EnvelopeOpenMachine" ||
  keyframes.stateMachine?.triggerInput !== "open"
) {
  fail("keyframes must declare EnvelopeOpenMachine with open trigger");
}

if (!Array.isArray(keyframes.timelineMs) || keyframes.timelineMs.at(-1)?.time !== 2200) {
  fail("keyframes timeline must end at 2200ms");
}

if (authoringManifest.output?.file !== "public/animations/home-envelope-open.riv") {
  fail("authoring manifest output file must be public/animations/home-envelope-open.riv");
}

if (
  authoringManifest.runtimeContract?.artboard !== keyframes.artboard?.name ||
  authoringManifest.runtimeContract?.stateMachine !== keyframes.stateMachine?.name ||
  authoringManifest.runtimeContract?.openInput !== keyframes.stateMachine?.triggerInput ||
  authoringManifest.runtimeContract?.openInputType !== "Trigger"
) {
  fail("authoring manifest runtime contract must match keyframes");
}

if (authoringManifest.runtimeContract?.durationMs !== keyframes.timelineMs.at(-1)?.time) {
  fail("authoring manifest duration must match keyframes final timeline time");
}

const configContract = {
  src: readExportedString(riveConfigSource, "HOME_ENVELOPE_RIVE_SRC"),
  artboard: readExportedString(riveConfigSource, "HOME_ENVELOPE_RIVE_ARTBOARD"),
  stateMachine: readExportedString(riveConfigSource, "HOME_ENVELOPE_RIVE_STATE_MACHINE"),
  input: readExportedString(riveConfigSource, "HOME_ENVELOPE_RIVE_OPEN_INPUT"),
  durationMs: readExportedNumber(riveConfigSource, "HOME_ENVELOPE_OPEN_MS"),
};

if (
  configContract.src !== "/animations/home-envelope-open.riv" ||
  configContract.artboard !== authoringManifest.runtimeContract.artboard ||
  configContract.stateMachine !== authoringManifest.runtimeContract.stateMachine ||
  configContract.input !== authoringManifest.runtimeContract.openInput ||
  configContract.durationMs !== authoringManifest.runtimeContract.durationMs
) {
  fail("homeEnvelopeRiveConfig.ts must match the authoring manifest runtime contract");
}

if (
  authoringManifest.primaryReferences?.keyframes !==
    "public/animations/reference/home-envelope-rive-keyframes-v2.json" ||
  authoringManifest.primaryReferences?.layerManifest !==
    "public/animations/reference/home-envelope-rive-layers-v2/layer-manifest.json"
) {
  fail("authoring manifest primary references must point at the v2 keyframes and layer manifest");
}

const keyframeLayerFiles = new Set((keyframes.layers ?? []).map((layer) => layer.file));
const authoringLayerFiles = new Set(
  (authoringManifest.allowedProductionLayerSource?.files ?? []).map(
    (fileName) =>
      `/${authoringManifest.allowedProductionLayerSource.directory.replace(/^public\//, "")}/${fileName}`,
  ),
);
const summaries = [];

for (const layer of manifest.layers) {
  const relativeFile = layer.file?.replace(/^\//, "");
  if (!relativeFile) fail(`layer ${layer.name ?? "(unnamed)"} is missing a file`);

  const filePath = path.join(root, "public", relativeFile.replace(/^animations\//, "animations/"));
  if (!fs.existsSync(filePath)) {
    fail(`${layer.file} does not exist`);
  }

  if (!keyframeLayerFiles.has(layer.file)) {
    fail(`${layer.file} is missing from home-envelope-rive-keyframes-v2.json`);
  }

  if (!authoringLayerFiles.has(layer.file)) {
    fail(`${layer.file} is missing from home-envelope-rive-authoring-manifest.json`);
  }

  const stats = analyzePng(filePath);
  if (stats.width !== layer.size?.width || stats.height !== layer.size?.height) {
    fail(
      `${layer.file} size mismatch: manifest ${layer.size?.width}x${layer.size?.height}, PNG ${stats.width}x${stats.height}`,
    );
  }

  if (stats.visiblePixels < 100) {
    fail(`${layer.file} has too few visible pixels`);
  }

  if (stats.transparentPixels < 100) {
    fail(`${layer.file} does not look like a transparent cutout`);
  }

  if (stats.greenishVisiblePixels > 0) {
    fail(`${layer.file} has ${stats.greenishVisiblePixels} greenish visible pixels`);
  }

  summaries.push({
    layer: layer.name,
    size: `${stats.width}x${stats.height}`,
    visiblePixels: stats.visiblePixels,
  });
}

console.log("home envelope Rive asset check passed.");
console.table(summaries);
