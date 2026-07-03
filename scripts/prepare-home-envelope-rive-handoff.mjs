import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(
  root,
  "public",
  "animations",
  "reference",
  "home-envelope-rive-authoring-manifest.json",
);
const outputDir = path.join(root, "artifacts", "home-envelope-rive-handoff");

function toAbsolute(relativePath) {
  return path.join(root, relativePath);
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function copyFileWithChecksum(sourceRelative, targetRelative, checksums) {
  const sourcePath = toAbsolute(sourceRelative);
  const targetPath = path.join(outputDir, targetRelative);
  const bytes = await readFile(sourcePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, bytes);

  checksums.push({
    file: toPosix(targetRelative),
    source: toPosix(sourceRelative),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

function buildReadme(manifest, checksums) {
  const layers = checksums
    .filter((entry) => entry.file.startsWith("layers/"))
    .map((entry) => `- \`${entry.file}\` (${entry.bytes} bytes)`)
    .join("\n");

  return `# Home Envelope Rive Handoff

This folder contains the source packet for authoring the production Rive file:

\`\`\`text
${manifest.output.file}
\`\`\`

The final file must be a real Rive runtime export. Do not substitute SVG, GIF, video, Lottie, or a Codex-generated approximation.

## Runtime Contract

\`\`\`text
Artboard: ${manifest.runtimeContract.artboard}
Size: ${manifest.runtimeContract.artboardSize.width} x ${manifest.runtimeContract.artboardSize.height}
State Machine: ${manifest.runtimeContract.stateMachine}
Input: ${manifest.runtimeContract.openInput}
Input Type: ${manifest.runtimeContract.openInputType}
Duration: ${manifest.runtimeContract.durationMs}ms
\`\`\`

## Included Layer Sources

Use these v2 transparent PNG layers as the only production raster source. You may redraw pieces directly in Rive at equal or higher quality.

${layers}

## Motion Beats

${manifest.motionBeats
  .map((beat) => `- ${beat.timeMs}ms: ${beat.name} - ${beat.description}`)
  .join("\n")}

## Rive Editor Steps

1. Open Rive Editor.
2. Open \`preview.html\` in a browser to understand the intended layer timing and background safety.
3. Create artboard \`${manifest.runtimeContract.artboard}\` at ${manifest.runtimeContract.artboardSize.width} x ${manifest.runtimeContract.artboardSize.height}.
4. Import the PNG layers from \`layers/\`.
5. Use \`TIMING.md\` for the human-readable timing sheet and \`home-envelope-rive-keyframes-v2.json\` for exact values.
6. Create state machine \`${manifest.runtimeContract.stateMachine}\`.
7. Add Trigger input \`${manifest.runtimeContract.openInput}\`.
8. Export the runtime file to \`${manifest.output.file}\`.
9. Run the acceptance commands below.

## Acceptance Commands

\`\`\`text
${manifest.acceptanceCommands.join("\n")}
\`\`\`

## Checksums

See \`checksums.json\`.
`;
}

function formatProperties(properties) {
  return Object.entries(properties)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("<br>");
}

function frameAt60Fps(timeMs) {
  return Math.round((timeMs / 1000) * 60);
}

function buildTimingMarkdown(manifest, keyframes) {
  const layerRows = keyframes.layers
    .map((layer) => {
      const origin = layer.transformOrigin ?? "-";
      return `| ${layer.name} | ${path.basename(layer.file)} | ${formatProperties(layer.initial)} | ${origin} |`;
    })
    .join("\n");

  const timelineRows = keyframes.timelineMs
    .flatMap((beat) => {
      const rows = [];
      rows.push(
        `| ${beat.time}ms | ${frameAt60Fps(beat.time)} | ${beat.label} | beat | ${beat.notes ?? "-"} |`,
      );

      for (const [target, values] of Object.entries(beat)) {
        if (target === "time" || target === "label" || target === "notes") {
          continue;
        }
        rows.push(
          `| ${beat.time}ms | ${frameAt60Fps(beat.time)} | ${beat.label} | ${target} | ${formatProperties(values)} |`,
        );
      }

      return rows;
    })
    .join("\n");

  const curveRows = Object.entries(keyframes.curves)
    .map(([name, values]) => `| ${name} | cubic ${values.join(", ")} |`)
    .join("\n");

  return `# Home Envelope Rive Timing Sheet

This timing sheet is generated from \`references/home-envelope-rive-keyframes-v2.json\`.

Use it while building the final Rive file:

\`\`\`text
${manifest.output.file}
\`\`\`

## Runtime Contract

\`\`\`text
Artboard: ${manifest.runtimeContract.artboard}
Size: ${manifest.runtimeContract.artboardSize.width} x ${manifest.runtimeContract.artboardSize.height}
State Machine: ${manifest.runtimeContract.stateMachine}
Trigger Input: ${manifest.runtimeContract.openInput}
Duration: ${manifest.runtimeContract.durationMs}ms
\`\`\`

## Layer Setup

| Layer | Source file | Initial values | Transform origin |
| --- | --- | --- | --- |
${layerRows}

## Timeline

| Time | Frame @60fps | Beat | Target | Values |
| --- | ---: | --- | --- | --- |
${timelineRows}

## Curves

| Name | Curve |
| --- | --- |
${curveRows}

## Notes

- Values are artboard-space references for a 1200 x 760 artboard.
- Recreate the motion in Rive Editor rather than shipping this browser/CSS preview.
- The final state should remain open until React hands off to the delivered photo view.
`;
}

function buildPreviewHtml(manifest) {
  const beatItems = manifest.motionBeats
    .map(
      (beat) =>
        `<li><span>${beat.timeMs}ms</span><strong>${beat.name}</strong><em>${beat.description}</em></li>`,
    )
    .join("");
  const duration = manifest.runtimeContract.durationMs;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Home Envelope Rive Handoff Preview</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #f7f0e2;
      --paper-deep: #d8c8ae;
      --ink: #3f3932;
      --seal: #ad4538;
      --line: rgba(91, 74, 57, 0.18);
      --duration: ${duration}ms;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: #eee5d7;
    }
    main {
      width: min(1120px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    h1, h2, p { margin: 0; }
    h1 { font-size: clamp(28px, 4vw, 44px); letter-spacing: 0; line-height: 1.08; }
    h2 { font-size: 20px; margin-top: 34px; margin-bottom: 14px; }
    p { max-width: 720px; margin-top: 12px; line-height: 1.7; color: rgba(63, 57, 50, 0.76); }
    button {
      appearance: none;
      border: 1px solid rgba(173, 69, 56, 0.38);
      background: rgba(255, 252, 245, 0.74);
      color: var(--seal);
      border-radius: 999px;
      padding: 11px 18px;
      margin-top: 20px;
      font: inherit;
      cursor: pointer;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
      gap: 32px;
      align-items: center;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 24px;
      background: rgba(255, 252, 245, 0.44);
      box-shadow: 0 22px 54px rgba(63, 57, 50, 0.08);
    }
    .stage-shell {
      padding: clamp(16px, 3vw, 28px);
    }
    .stage {
      position: relative;
      width: 100%;
      aspect-ratio: 1200 / 760;
      overflow: hidden;
      border-radius: 20px;
      background:
        radial-gradient(circle at 50% 47%, rgba(255, 244, 204, 0.46), transparent 38%),
        linear-gradient(135deg, rgba(255,255,255,0.45), rgba(226, 214, 196, 0.28));
    }
    .stage::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(90deg, rgba(82, 70, 54, 0.035) 1px, transparent 1px),
        linear-gradient(0deg, rgba(82, 70, 54, 0.026) 1px, transparent 1px);
      background-size: 44px 44px;
      mix-blend-mode: multiply;
      opacity: 0.5;
    }
    .layer {
      position: absolute;
      left: 50%;
      top: 50%;
      display: block;
      pointer-events: none;
      user-select: none;
      transform: translate(-50%, -50%);
      max-width: none;
    }
    .shadow { width: 56%; top: 86%; opacity: 0.7; }
    .inner { width: 64%; top: 45%; opacity: 0; }
    .card { width: 54%; top: 68%; opacity: 0; filter: blur(4px); }
    .pocket { width: 70%; top: 61%; opacity: 0; }
    .flap { width: 68%; top: 33%; opacity: 0; transform-origin: 50% 100%; }
    .closed { width: 88%; top: 58%; opacity: 1; }
    .glow { width: 62%; top: 50%; opacity: 0; mix-blend-mode: screen; }
    .wax { width: 18%; top: 59%; opacity: 1; }
    .wax-left, .wax-right { width: 12%; top: 59%; opacity: 0; }
    .crumbs { width: 24%; top: 65%; opacity: 0; }
    .motes { width: 76%; top: 39%; opacity: 0; }
    .is-playing .closed { animation: closedOut var(--duration) cubic-bezier(0.18, 0.82, 0.22, 1) both; }
    .is-playing .pocket { animation: pocketIn var(--duration) cubic-bezier(0.2, 0.82, 0.18, 1) both; }
    .is-playing .inner { animation: innerIn var(--duration) cubic-bezier(0.16, 0.96, 0.24, 1) both; }
    .is-playing .flap { animation: flapOpen var(--duration) cubic-bezier(0.16, 0.96, 0.24, 1) both; }
    .is-playing .glow { animation: glowPulse var(--duration) cubic-bezier(0.18, 0.82, 0.22, 1) both; }
    .is-playing .card { animation: cardRise var(--duration) cubic-bezier(0.2, 0.82, 0.18, 1) both; }
    .is-playing .wax { animation: waxBreak var(--duration) cubic-bezier(0.18, 0.82, 0.22, 1) both; }
    .is-playing .wax-left { animation: waxLeft var(--duration) cubic-bezier(0.18, 0.82, 0.22, 1) both; }
    .is-playing .wax-right { animation: waxRight var(--duration) cubic-bezier(0.18, 0.82, 0.22, 1) both; }
    .is-playing .crumbs { animation: crumbs var(--duration) cubic-bezier(0.18, 0.82, 0.22, 1) both; }
    .is-playing .motes { animation: motes var(--duration) cubic-bezier(0.2, 0.82, 0.18, 1) both; }
    .is-playing .shadow { animation: shadow var(--duration) cubic-bezier(0.32, 0, 0.2, 1) both; }
    @keyframes closedOut {
      0%, 18% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      23% { opacity: 0; transform: translate(-50%, -50%) scale(1.012); }
      100% { opacity: 0; }
    }
    @keyframes pocketIn {
      0%, 18% { opacity: 0; transform: translate(-50%, -48%) scale(0.996); }
      23%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      47% { transform: translate(-50%, calc(-50% - 5px)); }
      58% { transform: translate(-50%, -50%); }
    }
    @keyframes innerIn {
      0%, 18% { opacity: 0; transform: translate(-50%, -44%) scale(0.96); }
      28% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.03); }
      100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes flapOpen {
      0%, 19% { opacity: 0; transform: translate(-50%, 14%) scaleY(0.22) rotateX(0deg); }
      24% { opacity: 1; transform: translate(-50%, -20%) scaleY(0.58) rotateX(-28deg); }
      36% { opacity: 1; transform: translate(-50%, -76%) scaleY(1) rotateX(-112deg); }
      48%, 100% { opacity: 1; transform: translate(-50%, -70%) scaleY(1) rotateX(-104deg); }
    }
    @keyframes glowPulse {
      0%, 12% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
      28% { opacity: 0.38; transform: translate(-50%, -50%) scale(0.72); }
      48% { opacity: 0.82; transform: translate(-50%, -50%) scale(1.12); }
      74% { opacity: 0.66; transform: translate(-50%, -50%) scale(1.04); }
      100% { opacity: 0.46; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes cardRise {
      0%, 47% { opacity: 0; filter: blur(5px); transform: translate(-50%, -24%) scale(0.94); }
      58% { opacity: 0.8; filter: blur(2px); transform: translate(-50%, -70%) scale(0.98); }
      72%, 100% { opacity: 1; filter: blur(0); transform: translate(-50%, -92%) scale(1); }
    }
    @keyframes waxBreak {
      0%, 10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      15% { opacity: 1; transform: translate(-50%, -50%) scaleX(1.04) scaleY(0.94); }
      20% { opacity: 0; transform: translate(-50%, -50%) scale(1.03); }
      100% { opacity: 0; }
    }
    @keyframes waxLeft {
      0%, 16% { opacity: 0; transform: translate(-50%, -50%) rotate(0deg); }
      20% { opacity: 1; transform: translate(calc(-50% - 8px), -50%) rotate(-3deg); }
      36%, 100% { opacity: 1; transform: translate(calc(-50% - 18px), -49%) rotate(-7deg); }
    }
    @keyframes waxRight {
      0%, 16% { opacity: 0; transform: translate(-50%, -50%) rotate(0deg); }
      20% { opacity: 1; transform: translate(calc(-50% + 8px), -50%) rotate(3deg); }
      36%, 100% { opacity: 1; transform: translate(calc(-50% + 18px), -49%) rotate(7deg); }
    }
    @keyframes crumbs {
      0%, 18% { opacity: 0; transform: translate(-50%, -60%) scale(0.7); }
      24% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      54% { opacity: 0.7; transform: translate(-50%, calc(-50% + 15px)) scale(0.96); }
      100% { opacity: 0; transform: translate(-50%, calc(-50% + 22px)) scale(0.92); }
    }
    @keyframes motes {
      0%, 18% { opacity: 0; transform: translate(-50%, -50%) scale(0.72); }
      28% { opacity: 0.82; transform: translate(-50%, -50%) scale(0.9); }
      64% { opacity: 0.7; transform: translate(-50%, calc(-50% - 18px)) scale(1.04); }
      100% { opacity: 0; transform: translate(-50%, calc(-50% - 34px)) scale(1.12); }
    }
    @keyframes shadow {
      0% { opacity: 0.72; transform: translate(-50%, -50%) scale(1); }
      5% { opacity: 0.82; transform: translate(-50%, -50%) scaleX(1.04) scaleY(0.92); }
      48% { opacity: 0.6; transform: translate(-50%, -50%) scaleX(0.94) scaleY(0.9); }
      100% { opacity: 0.72; transform: translate(-50%, -50%) scale(1); }
    }
    .beats {
      display: grid;
      gap: 10px;
      padding: 0;
      margin: 22px 0 0;
      list-style: none;
    }
    .beats li {
      display: grid;
      grid-template-columns: 72px 130px 1fr;
      gap: 12px;
      align-items: baseline;
      padding: 11px 0;
      border-bottom: 1px solid var(--line);
    }
    .beats span { color: var(--seal); font-variant-numeric: tabular-nums; }
    .beats strong { font-weight: 650; }
    .beats em { color: rgba(63, 57, 50, 0.68); font-style: normal; line-height: 1.45; }
    .tone-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 14px;
    }
    .tone-card {
      border-radius: 18px;
      padding: 10px;
      border: 1px solid var(--line);
      background: var(--tone);
    }
    .tone-card .stage {
      border-radius: 14px;
      background: var(--tone);
    }
    .tone-card small {
      display: block;
      margin-top: 8px;
      color: rgba(63, 57, 50, 0.68);
      font-size: 12px;
    }
    @media (max-width: 820px) {
      main { width: min(100vw - 20px, 540px); padding-top: 20px; }
      .hero { grid-template-columns: 1fr; }
      .beats li { grid-template-columns: 64px 1fr; }
      .beats em { grid-column: 2; }
      .tone-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <h1>Home Envelope Rive Preview</h1>
        <p>This is a browser-only timing preview for the Rive authoring pass. The production output is still a real .riv file with the contract in this folder.</p>
        <button type="button" id="replay">Replay opening</button>
      </div>
      <div class="panel stage-shell">
        ${buildStageMarkup("main-stage is-playing")}
      </div>
    </section>

    <h2>Motion Beats</h2>
    <ol class="beats">${beatItems}</ol>

    <h2>Time Tone Safety</h2>
    <div class="tone-grid">
      ${[
        ["Dawn", "#ded8d2"],
        ["Morning", "#f3ead9"],
        ["Noon", "#fbf4e7"],
        ["Evening", "#e7d2c4"],
        ["Night", "#c9c7d1"],
      ]
        .map(
          ([name, color]) =>
            `<div class="tone-card" style="--tone:${color}">${buildStageMarkup("is-playing")}<small>${name}</small></div>`,
        )
        .join("")}
    </div>
  </main>
  <script>
    const replay = document.getElementById("replay");
    const stages = Array.from(document.querySelectorAll(".stage"));
    replay.addEventListener("click", () => {
      stages.forEach((stage) => {
        stage.classList.remove("is-playing");
        void stage.offsetWidth;
        stage.classList.add("is-playing");
      });
    });
  </script>
</body>
</html>
`;
}

function buildStageMarkup(className) {
  const layers = [
    ["shadow", "11-11-envelope-shadow.png"],
    ["inner", "04-04-back-inner-panel.png"],
    ["card", "10-10-photo-card-placeholder.png"],
    ["pocket", "02-02-open-front-pocket.png"],
    ["flap", "03-03-top-flap.png"],
    ["closed", "01-01-closed-envelope-body.png"],
    ["glow", "09-09-inner-glow.png"],
    ["wax", "05-05-wax-seal-intact.png"],
    ["wax-left", "06-06-wax-seal-left.png"],
    ["wax-right", "07-07-wax-seal-right.png"],
    ["crumbs", "08-08-wax-crumbs.png"],
    ["motes", "12-12-paper-motes.png"],
  ];
  const markup = layers
    .map(
      ([name, file]) =>
        `<img class="layer ${name}" src="layers/${file}" alt="" />`,
    )
    .join("");

  return `<div class="stage ${className}" aria-label="Envelope layer motion preview">${markup}</div>`;
}

const manifest = await readJson(manifestPath);
const keyframes = await readJson(toAbsolute(manifest.primaryReferences.keyframes));
const outputParent = path.dirname(outputDir);
const resolvedOutputDir = path.resolve(outputDir);

if (!resolvedOutputDir.startsWith(path.resolve(outputParent))) {
  throw new Error("Refusing to write handoff outside artifacts directory.");
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const checksums = [];

await copyFileWithChecksum(
  "public/animations/reference/home-envelope-rive-authoring-manifest.json",
  "home-envelope-rive-authoring-manifest.json",
  checksums,
);
await copyFileWithChecksum(
  manifest.primaryReferences.storyboard,
  "references/home-envelope-rive-storyboard-v2.png",
  checksums,
);
await copyFileWithChecksum(
  manifest.primaryReferences.keyframes,
  "references/home-envelope-rive-keyframes-v2.json",
  checksums,
);
await copyFileWithChecksum(
  manifest.primaryReferences.layerManifest,
  "references/layer-manifest.json",
  checksums,
);
await copyFileWithChecksum(
  manifest.primaryReferences.editorPrompt,
  "docs/home-envelope-rive-editor-agent-prompt.md",
  checksums,
);
await copyFileWithChecksum(
  manifest.primaryReferences.productionBrief,
  "docs/home-envelope-rive-production-brief.md",
  checksums,
);
await copyFileWithChecksum(
  manifest.primaryReferences.authoringOptions,
  "docs/home-envelope-rive-authoring-options.md",
  checksums,
);

for (const fileName of manifest.allowedProductionLayerSource.files) {
  const source = `${manifest.allowedProductionLayerSource.directory}/${fileName}`;
  await copyFileWithChecksum(source, `layers/${fileName}`, checksums);
}

const readme = buildReadme(manifest, checksums);
await writeFile(path.join(outputDir, "README.md"), readme, "utf8");
await writeFile(path.join(outputDir, "TIMING.md"), buildTimingMarkdown(manifest, keyframes), "utf8");
await writeFile(path.join(outputDir, "preview.html"), buildPreviewHtml(manifest), "utf8");
await writeFile(
  path.join(outputDir, "checksums.json"),
  `${JSON.stringify(checksums, null, 2)}\n`,
  "utf8",
);

const finalStats = await stat(outputDir);
void finalStats;

console.log(`Rive handoff prepared: ${path.relative(root, outputDir)}`);
console.log(`Files copied: ${checksums.length}`);
