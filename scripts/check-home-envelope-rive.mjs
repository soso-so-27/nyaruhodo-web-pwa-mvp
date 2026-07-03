import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { StateMachineInputType } = require("@rive-app/canvas");

const workspace = process.cwd();
const assetPath = join(workspace, "public", "animations", "home-envelope-open.riv");
const runtimeScriptPath = join(workspace, "node_modules", "@rive-app", "canvas", "rive.js");
const runtimeWasmPath = join(workspace, "node_modules", "@rive-app", "canvas", "rive.wasm");
const maxBytes = 1_000_000;
const targetBytes = 500_000;
const requiredContract = {
  artboard: "HomeEnvelopeOpen",
  stateMachine: "EnvelopeOpenMachine",
  input: "open",
  inputType: StateMachineInputType.Trigger,
};
const minVisibleSamples = 50;
const minOpenDiffRatio = 0.02;

async function inspectRiveFile(bytes) {
  const wasm = await readFile(runtimeWasmPath);
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto("about:blank");
    await page.addScriptTag({ path: runtimeScriptPath });

    return await page.evaluate(
      async ({ rivBytes, wasmBytes, contract }) => {
        const api = window.rive;

        if (!api?.Rive || !api?.RuntimeLoader) {
          throw new Error("Rive runtime did not initialize in the browser context.");
        }

        api.RuntimeLoader.setWasmBinary(new Uint8Array(wasmBytes).buffer);

        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 760;
        document.body.appendChild(canvas);
        const context = canvas.getContext("2d", { willReadFrequently: true });

        if (!context) {
          throw new Error("Could not create 2D canvas context for visual inspection.");
        }

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const waitFrames = async (count) => {
          for (let i = 0; i < count; i += 1) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
        };
        const sampleCanvas = () => {
          const step = 4;
          const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const values = [];
          let visibleSamples = 0;
          let totalAlpha = 0;

          for (let y = 0; y < canvas.height; y += step) {
            for (let x = 0; x < canvas.width; x += step) {
              const offset = (y * canvas.width + x) * 4;
              const r = image[offset];
              const g = image[offset + 1];
              const b = image[offset + 2];
              const a = image[offset + 3];

              values.push(r, g, b, a);
              totalAlpha += a;

              if (a > 8 && r + g + b > 12) {
                visibleSamples += 1;
              }
            }
          }

          return {
            values,
            visibleSamples,
            totalAlpha,
          };
        };
        const diffRatio = (a, b) => {
          let changed = 0;
          const pixelCount = a.values.length / 4;

          for (let offset = 0; offset < a.values.length; offset += 4) {
            const dr = Math.abs(a.values[offset] - b.values[offset]);
            const dg = Math.abs(a.values[offset + 1] - b.values[offset + 1]);
            const db = Math.abs(a.values[offset + 2] - b.values[offset + 2]);
            const da = Math.abs(a.values[offset + 3] - b.values[offset + 3]);

            if (dr + dg + db + da > 28) {
              changed += 1;
            }
          }

          return changed / pixelCount;
        };

        const rive = new api.Rive({
          buffer: new Uint8Array(rivBytes).buffer,
          canvas,
          artboard: contract.artboard,
          stateMachines: contract.stateMachine,
          autoplay: true,
          shouldDisableRiveListeners: true,
          automaticallyHandleEvents: false,
        });

        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Timed out while loading Rive runtime asset.")),
            10000,
          );

          rive.on(api.EventType.Load, () => {
            clearTimeout(timer);
            resolve();
          });
          rive.on(api.EventType.LoadError, (event) => {
            clearTimeout(timer);
            reject(new Error(`Rive load error: ${JSON.stringify(event)}`));
          });
        });

        const inputs = rive.stateMachineInputs(contract.stateMachine)?.map((input) => ({
          name: input.name,
          type: input.type,
        })) ?? [];
        await waitFrames(4);

        const idleSample = sampleCanvas();
        const openInput = rive
          .stateMachineInputs(contract.stateMachine)
          ?.find((input) => input.name === contract.input);

        if (openInput?.type === contract.inputType && typeof openInput.fire === "function") {
          openInput.fire();
        }

        await wait(900);
        await waitFrames(2);
        const midOpenSample = sampleCanvas();
        await wait(1500);
        await waitFrames(2);
        const finalOpenSample = sampleCanvas();
        const contents = rive.contents;
        const result = {
          activeArtboard: rive.activeArtboard,
          artboardWidth: rive.artboardWidth,
          artboardHeight: rive.artboardHeight,
          animationNames: rive.animationNames,
          stateMachineNames: rive.stateMachineNames,
          inputs,
          contents,
          visual: {
            idleVisibleSamples: idleSample.visibleSamples,
            midOpenVisibleSamples: midOpenSample.visibleSamples,
            finalOpenVisibleSamples: finalOpenSample.visibleSamples,
            idleToMidDiffRatio: diffRatio(idleSample, midOpenSample),
            idleToFinalDiffRatio: diffRatio(idleSample, finalOpenSample),
            midToFinalDiffRatio: diffRatio(midOpenSample, finalOpenSample),
          },
        };

        rive.cleanup();
        return result;
      },
      {
        rivBytes: Array.from(bytes),
        wasmBytes: Array.from(wasm),
        contract: requiredContract,
      },
    );
  } finally {
    await browser.close();
  }
}

function assertRiveVisuals(info) {
  if (!info.visual) {
    throw new Error("Missing visual inspection result.");
  }

  if (
    info.visual.idleVisibleSamples < minVisibleSamples ||
    info.visual.finalOpenVisibleSamples < minVisibleSamples
  ) {
    throw new Error(
      `Rive canvas appears blank. Visible samples idle=${info.visual.idleVisibleSamples}, final=${info.visual.finalOpenVisibleSamples}.`,
    );
  }

  const strongestDiff = Math.max(
    info.visual.idleToMidDiffRatio,
    info.visual.idleToFinalDiffRatio,
    info.visual.midToFinalDiffRatio,
  );

  if (strongestDiff < minOpenDiffRatio) {
    throw new Error(
      `Rive open trigger does not produce enough visual change. Strongest diff ratio=${strongestDiff.toFixed(
        4,
      )}, expected at least ${minOpenDiffRatio}.`,
    );
  }
}

function assertRiveContract(info) {
  if (info.activeArtboard !== requiredContract.artboard) {
    throw new Error(
      `Unexpected active artboard: expected ${requiredContract.artboard}, received ${JSON.stringify(
        info.activeArtboard,
      )}`,
    );
  }

  if (!info.stateMachineNames.includes(requiredContract.stateMachine)) {
    throw new Error(
      `Missing state machine ${requiredContract.stateMachine}. Found: ${info.stateMachineNames.join(
        ", ",
      )}`,
    );
  }

  const input = info.inputs.find((candidate) => candidate.name === requiredContract.input);

  if (!input) {
    throw new Error(
      `Missing state machine input ${requiredContract.input}. Found: ${info.inputs
        .map((candidate) => candidate.name)
        .join(", ")}`,
    );
  }

  if (input.type !== requiredContract.inputType) {
    throw new Error(
      `Input ${requiredContract.input} must be Trigger (${requiredContract.inputType}), received ${input.type}.`,
    );
  }
}

try {
  const file = await stat(assetPath);
  const bytes = await readFile(assetPath);
  const magic = bytes.subarray(0, 4).toString("ascii");

  if (magic !== "RIVE") {
    throw new Error(`Invalid Rive magic header: expected RIVE, received ${JSON.stringify(magic)}`);
  }

  if (file.size > maxBytes) {
    throw new Error(`Rive file is too large: ${file.size} bytes. Hard stop is ${maxBytes} bytes.`);
  }

  const sizeNote =
    file.size <= targetBytes
      ? "within target"
      : `above target ${targetBytes} bytes, but under hard stop`;
  const info = await inspectRiveFile(bytes);

  assertRiveContract(info);
  assertRiveVisuals(info);

  console.log(`home-envelope-open.riv ok: ${file.size} bytes, ${sizeNote}`);
  console.log(
    `Rive contract ok: ${info.activeArtboard} / ${requiredContract.stateMachine} / ${requiredContract.input}`,
  );
  console.log(
    `Rive visual ok: visible samples ${info.visual.idleVisibleSamples} -> ${info.visual.finalOpenVisibleSamples}, max diff ${Math.max(
      info.visual.idleToMidDiffRatio,
      info.visual.idleToFinalDiffRatio,
      info.visual.midToFinalDiffRatio,
    ).toFixed(4)}`,
  );
} catch (error) {
  console.error("home-envelope-open.riv check failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
