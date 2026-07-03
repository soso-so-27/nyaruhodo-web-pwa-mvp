import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const artifactDir = path.join(root, "artifacts");
const handoffDir = path.join(artifactDir, "home-envelope-rive-handoff");
const zipPath = path.join(artifactDir, "home-envelope-rive-handoff.zip");
const verifyDir = path.join(artifactDir, ".home-envelope-rive-handoff-zip-verify");
const expectedFiles = [
  "README.md",
  "TIMING.md",
  "preview.html",
  "checksums.json",
  "home-envelope-rive-authoring-manifest.json",
  "references/home-envelope-rive-storyboard-v2.png",
  "references/home-envelope-rive-keyframes-v2.json",
  "references/layer-manifest.json",
  "docs/home-envelope-rive-editor-agent-prompt.md",
  "docs/home-envelope-rive-production-brief.md",
  "docs/home-envelope-rive-authoring-options.md",
  "layers/01-01-closed-envelope-body.png",
  "layers/02-02-open-front-pocket.png",
  "layers/03-03-top-flap.png",
  "layers/04-04-back-inner-panel.png",
  "layers/05-05-wax-seal-intact.png",
  "layers/06-06-wax-seal-left.png",
  "layers/07-07-wax-seal-right.png",
  "layers/08-08-wax-crumbs.png",
  "layers/09-09-inner-glow.png",
  "layers/10-10-photo-card-placeholder.png",
  "layers/11-11-envelope-shadow.png",
  "layers/12-12-paper-motes.png",
];

function assertInsideArtifacts(targetPath) {
  const resolvedArtifacts = path.resolve(artifactDir);
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedArtifacts)) {
    throw new Error(`Refusing to write outside artifacts: ${resolvedTarget}`);
  }
}

async function assertFile(filePath) {
  const file = await stat(filePath);
  if (!file.isFile()) {
    throw new Error(`${path.relative(root, filePath)} is not a file`);
  }
  return file;
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function compressWithPowershell() {
  const command = [
    "$ErrorActionPreference = 'Stop';",
    "$source = Join-Path $PWD 'artifacts/home-envelope-rive-handoff/*';",
    "$destination = Join-Path $PWD 'artifacts/home-envelope-rive-handoff.zip';",
    "if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force };",
    "Compress-Archive -Path $source -DestinationPath $destination -CompressionLevel Optimal;",
  ].join(" ");

  await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: root,
    windowsHide: true,
  });
}

async function expandWithPowershell() {
  const command = [
    "$ErrorActionPreference = 'Stop';",
    "$source = Join-Path $PWD 'artifacts/home-envelope-rive-handoff.zip';",
    "$destination = Join-Path $PWD 'artifacts/.home-envelope-rive-handoff-zip-verify';",
    "if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force };",
    "Expand-Archive -LiteralPath $source -DestinationPath $destination -Force;",
  ].join(" ");

  await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: root,
    windowsHide: true,
  });
}

if (process.platform !== "win32") {
  throw new Error("pack:rive-envelope-handoff currently uses PowerShell Compress-Archive.");
}

assertInsideArtifacts(zipPath);
assertInsideArtifacts(verifyDir);
await mkdir(artifactDir, { recursive: true });
await assertFile(path.join(handoffDir, "README.md"));
await compressWithPowershell();

const zipStats = await assertFile(zipPath);
if (zipStats.size < 50_000) {
  throw new Error(`Zip looks too small: ${zipStats.size} bytes`);
}

await expandWithPowershell();

for (const file of expectedFiles) {
  await assertFile(path.join(verifyDir, file));
}

const sourceChecksums = JSON.parse(
  await readFile(path.join(handoffDir, "checksums.json"), "utf8"),
);

for (const entry of sourceChecksums) {
  const expandedPath = path.join(verifyDir, entry.file);
  const expandedSha = await sha256(expandedPath);
  if (expandedSha !== entry.sha256) {
    throw new Error(`Expanded zip checksum mismatch: ${entry.file}`);
  }
}

const zipSha = await sha256(zipPath);
await writeFile(
  path.join(artifactDir, "home-envelope-rive-handoff.zip.sha256"),
  `${zipSha}  home-envelope-rive-handoff.zip\n`,
  "utf8",
);
await rm(verifyDir, { recursive: true, force: true });

console.log(`Rive handoff zip prepared: ${path.relative(root, zipPath)}`);
console.log(`Zip bytes: ${zipStats.size}`);
console.log(`Zip sha256: ${zipSha}`);
