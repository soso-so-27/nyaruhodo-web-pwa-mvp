import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { chromium } from "playwright";

const workspace = process.cwd();
const outputDir = join(workspace, "artifacts", "rive-prototype-previews");
const runtimeScriptPath = join(
  workspace,
  "node_modules",
  "@rive-app",
  "canvas",
  "rive.js",
);
const runtimeWasmPath = join(
  workspace,
  "node_modules",
  "@rive-app",
  "canvas",
  "rive.wasm",
);
const defaultCandidates = [
  "public/animations/prototypes/email-icon.riv",
  "public/animations/prototypes/envelop-and-circles.riv",
  "public/animations/prototypes/envelope-study.riv",
  "public/animations/prototypes/envelope.riv",
  "public/animations/prototypes/interactive-letter.riv",
  "public/animations/prototypes/open-letter.riv",
  "public/animations/prototypes/otp-envelope.riv",
  "public/animations/prototypes/market-envelope.riv",
];
const maxDefaultBytes = 5_000_000;
const canvas = {
  width: 720,
  height: 456,
};

const candidates = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultCandidates;
const wasm = await readFile(runtimeWasmPath);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    viewport: canvas,
    deviceScaleFactor: 1,
  });

  await page.goto("about:blank");
  await page.addScriptTag({ path: runtimeScriptPath });

  const results = [];

  for (const candidate of candidates) {
    const filePath = join(workspace, candidate);
    const bytes = await readFile(filePath);
    const fileName = basename(candidate, ".riv");

    if (bytes.byteLength > maxDefaultBytes && process.argv.slice(2).length === 0) {
      results.push({
        file: candidate,
        bytes: bytes.byteLength,
        magic: bytes.subarray(0, 4).toString("ascii"),
        skipped: `over ${maxDefaultBytes} bytes; pass the path explicitly to inspect`,
      });
      continue;
    }

    const info = await page
      .evaluate(
        async ({ rivBytes, wasmBytes, canvasSize }) => {
          document.body.innerHTML = `<canvas id="preview" width="${canvasSize.width}" height="${canvasSize.height}" style="width:${canvasSize.width}px;height:${canvasSize.height}px;background:#efe7dd"></canvas>`;

          const api = window.rive;
          api.RuntimeLoader.setWasmBinary(new Uint8Array(wasmBytes).buffer);

          const previewCanvas = document.getElementById("preview");
          const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const rive = await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Rive candidate load timeout")),
              8000,
            );
            const instance = new api.Rive({
              buffer: new Uint8Array(rivBytes).buffer,
              canvas: previewCanvas,
              autoplay: true,
              fit: api.Fit.Contain,
              shouldDisableRiveListeners: true,
              automaticallyHandleEvents: false,
              onLoad: () => {
                clearTimeout(timer);
                resolve(instance);
              },
              onLoadError: (event) => {
                clearTimeout(timer);
                reject(new Error(JSON.stringify(event)));
              },
            });
          });

          await wait(260);

          const stateMachineNames = rive.stateMachineNames ?? [];
          const inputs = {};

          for (const stateMachine of stateMachineNames) {
            inputs[stateMachine] =
              rive.stateMachineInputs(stateMachine)?.map((input) => ({
                name: input.name,
                type: input.type,
              })) ?? [];
          }

          const context = previewCanvas.getContext("2d", {
            willReadFrequently: true,
          });
          const data = context.getImageData(
            0,
            0,
            previewCanvas.width,
            previewCanvas.height,
          ).data;
          let visibleSamples = 0;

          for (let y = 0; y < previewCanvas.height; y += 8) {
            for (let x = 0; x < previewCanvas.width; x += 8) {
              const offset = (y * previewCanvas.width + x) * 4;
              const rgb = data[offset] + data[offset + 1] + data[offset + 2];

              if (data[offset + 3] > 8 && rgb > 12) {
                visibleSamples += 1;
              }
            }
          }

          const result = {
            activeArtboard: rive.activeArtboard,
            artboardWidth: rive.artboardWidth,
            artboardHeight: rive.artboardHeight,
            animationNames: rive.animationNames ?? [],
            stateMachineNames,
            inputs,
            visibleSamples,
          };

          rive.cleanup();
          return result;
        },
        {
          rivBytes: Array.from(bytes),
          wasmBytes: Array.from(wasm),
          canvasSize: canvas,
        },
      )
      .catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      }));

    await page.screenshot({
      path: join(outputDir, `${fileName}.png`),
    });

    results.push({
      file: candidate,
      bytes: bytes.byteLength,
      magic: bytes.subarray(0, 4).toString("ascii"),
      ...info,
    });
  }

  await writeFile(join(outputDir, "inspection.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Rive prototype inspection written to ${outputDir}`);
  console.table(
    results.map((result) => ({
      file: result.file,
      bytes: result.bytes,
      artboard: result.activeArtboard ?? "",
      stateMachines: result.stateMachineNames?.join(", ") ?? "",
      visible: result.visibleSamples ?? "",
      skipped: result.skipped ?? "",
      error: result.error ?? "",
    })),
  );
} finally {
  await browser.close();
}
