import { spawnSync } from "node:child_process";

if (process.env.CI) {
  console.log("npm run shots is local-only; skipping in CI.");
  process.exit(0);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  command,
  ["playwright", "test", "-c", "playwright.shots.config.ts"],
  {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  },
);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
