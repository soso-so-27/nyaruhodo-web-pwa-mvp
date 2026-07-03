import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = process.cwd();
const handoffDir = path.join(root, "artifacts", "home-envelope-rive-handoff");
const checksumsPath = path.join(handoffDir, "checksums.json");
const readmePath = path.join(handoffDir, "README.md");
const timingPath = path.join(handoffDir, "TIMING.md");
const previewPath = path.join(handoffDir, "preview.html");
const requiredLayerCount = 12;
const requiredChecksumCount = 19;
const expectedContract = {
  artboard: "HomeEnvelopeOpen",
  stateMachine: "EnvelopeOpenMachine",
  input: "open",
  duration: "2200ms",
};

function fail(message) {
  console.error(`home envelope Rive handoff check failed: ${message}`);
  process.exit(1);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(`cannot read ${path.relative(root, filePath)}: ${error.message}`);
  }
}

async function assertFile(filePath) {
  try {
    const file = await stat(filePath);
    if (!file.isFile()) {
      fail(`${path.relative(root, filePath)} is not a file`);
    }
    return file;
  } catch (error) {
    fail(`${path.relative(root, filePath)} is missing: ${error.message}`);
  }
}

async function assertChecksums() {
  const checksums = await readJson(checksumsPath);
  if (!Array.isArray(checksums) || checksums.length !== requiredChecksumCount) {
    fail(`checksums.json must contain ${requiredChecksumCount} entries`);
  }

  const layerEntries = checksums.filter((entry) => entry.file?.startsWith("layers/"));
  if (layerEntries.length !== requiredLayerCount) {
    fail(`handoff must include ${requiredLayerCount} layer files`);
  }

  for (const entry of checksums) {
    if (!entry.file || !entry.sha256 || typeof entry.bytes !== "number") {
      fail(`invalid checksum entry: ${JSON.stringify(entry)}`);
    }

    const filePath = path.join(handoffDir, entry.file);
    const bytes = await readFile(filePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    if (bytes.length !== entry.bytes) {
      fail(`${entry.file} byte count changed`);
    }

    if (sha256 !== entry.sha256) {
      fail(`${entry.file} checksum mismatch`);
    }
  }

  return checksums;
}

async function assertReadme() {
  const readme = await readFile(readmePath, "utf8");
  const requiredText = [
    expectedContract.artboard,
    expectedContract.stateMachine,
    expectedContract.input,
    expectedContract.duration,
    "preview.html",
    "public/animations/home-envelope-open.riv",
  ];

  for (const text of requiredText) {
    if (!readme.includes(text)) {
      fail(`README.md is missing ${text}`);
    }
  }
}

async function assertTiming() {
  const timing = await readFile(timingPath, "utf8");
  const requiredText = [
    "Home Envelope Rive Timing Sheet",
    expectedContract.artboard,
    expectedContract.stateMachine,
    expectedContract.input,
    expectedContract.duration,
    "closed_envelope_body",
    "photo_card_placeholder",
    "top_flap",
    "seal_break",
    "flap_open",
    "photo_peek",
    "| Time | Frame @60fps | Beat | Target | Values |",
    "| 2200ms | 132 | settled |",
  ];

  for (const text of requiredText) {
    if (!timing.includes(text)) {
      fail(`TIMING.md is missing ${text}`);
    }
  }
}

async function assertPreview() {
  await assertFile(previewPath);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  try {
    await page.goto(pathToFileURL(previewPath).href);
    const beforeClick = await page.evaluate(() => {
      const images = Array.from(document.images).map((image) => ({
        src: image.getAttribute("src"),
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      }));

      return {
        title: document.title,
        stageCount: document.querySelectorAll(".stage").length,
        playingStageCount: document.querySelectorAll(".stage.is-playing").length,
        replayButton: Boolean(document.querySelector("#replay")),
        imageCount: images.length,
        brokenImages: images.filter(
          (image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0,
        ),
        duration: getComputedStyle(document.documentElement).getPropertyValue("--duration").trim(),
      };
    });

    if (beforeClick.title !== "Home Envelope Rive Handoff Preview") {
      fail("preview title is incorrect");
    }

    if (beforeClick.stageCount !== 6 || beforeClick.playingStageCount !== 6) {
      fail("preview must render six active stages");
    }

    if (!beforeClick.replayButton) {
      fail("preview must include replay button");
    }

    if (beforeClick.imageCount !== requiredLayerCount * 6) {
      fail(`preview must render ${requiredLayerCount * 6} layer images`);
    }

    if (beforeClick.brokenImages.length > 0) {
      fail(`preview has broken images: ${JSON.stringify(beforeClick.brokenImages)}`);
    }

    if (beforeClick.duration !== expectedContract.duration) {
      fail(`preview duration must be ${expectedContract.duration}`);
    }

    await page.click("#replay");
    const afterClickPlayingCount = await page.evaluate(
      () => document.querySelectorAll(".stage.is-playing").length,
    );

    if (afterClickPlayingCount !== 6) {
      fail("replay button did not restore all playing stages");
    }

    if (consoleErrors.length > 0) {
      fail(`preview logged console errors: ${consoleErrors.join(" | ")}`);
    }
  } finally {
    await browser.close();
  }
}

await assertFile(readmePath);
await assertFile(timingPath);
await assertChecksums();
await assertReadme();
await assertTiming();
await assertPreview();

console.log("home envelope Rive handoff check passed.");
