import { defineConfig, devices } from "@playwright/test";

const testSupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key",
};

for (const [key, value] of Object.entries(testSupabaseEnv)) {
  process.env[key] ??= value;
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
  "**/sleeping-delivery-request-guards.spec.ts",
  "**/sleeping-delivery-pool-guards.spec.ts",
];

const mobileSpecs = [
  "**/admin-test-tool-guards.spec.ts",
  "**/app-sheet-behavior.spec.ts",
  "**/cats-duplicate-name.spec.ts",
  "**/collection-album-flow.spec.ts",
  "**/home-day-cycle-indicator.spec.ts",
  "**/home-desk-model.spec.ts",
  "**/home-sleeping-exchange-flow.spec.ts",
  "**/onboarding-delivery-flow.spec.ts",
  "**/ui-theme-and-cats-profile.spec.ts",
];

export default defineConfig({
  testDir: "./tests/e2e",
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
