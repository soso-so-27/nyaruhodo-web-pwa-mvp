import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
}

const localEnv = readEnvFile(path.resolve(process.cwd(), ".env.local"));

function resolveEnv(name: string, fallback = ""): string {
  return process.env[name] ?? localEnv[name] ?? fallback;
}

const testSupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: resolveEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "http://127.0.0.1:54321",
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: resolveEnv("SUPABASE_SERVICE_ROLE_KEY"),
};

for (const [key, value] of Object.entries(testSupabaseEnv)) {
  if (value) {
    process.env[key] ??= value;
  }
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

const desktopSpecs = [
  "**/beta-release-smoke.spec.ts",
  "**/cat-celebrations-logic.spec.ts",
  "**/cat-footprints-logic.spec.ts",
  "**/cat-pickup-logic.spec.ts",
  "**/cat-year-summary-logic.spec.ts",
  "**/desktop-device-gate.spec.ts",
  "**/onboarding-handoff-restore.spec.ts",
  "**/sleeping-delivery-request-guards.spec.ts",
  "**/sleeping-delivery-pool-guards.spec.ts",
  "**/sw-image-cache.spec.ts",
];

const mobileSpecs = [
  "**/admin-test-tool-guards.spec.ts",
  "**/account-deletion-ui.spec.ts",
  "**/app-sheet-behavior.spec.ts",
  "**/cats-duplicate-name.spec.ts",
  "**/collection-album-flow.spec.ts",
  "**/home-day-cycle-indicator.spec.ts",
  "**/home-desk-model.spec.ts",
  "**/home-sleeping-exchange-flow.spec.ts",
  "**/onboarding-delivery-flow.spec.ts",
  "**/settings-page-organization.spec.ts",
  "**/ui-theme-and-cats-profile.spec.ts",
];

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      testMatch: desktopSpecs,
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      },
    },
    {
      name: "mobile",
      testMatch: mobileSpecs,
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
      },
    },
  ],
  webServer: useExternalServer
    ? undefined
    : {
        command: process.platform === "win32" ? "npm.cmd run dev" : "npm run dev",
        env: {
          ...process.env,
          ...testSupabaseEnv,
        },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
