import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: "android-chrome-critical",
      testMatch: "**/onboarding-delivery-flow.spec.ts",
      grep:
        /keeps every onboarding step centered on a narrow Android viewport|does not keep a false photo error after a delayed LINE image loads|shows the Android install guide after daytime onboarding|shows only the new received letter after a test reset/,
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
      },
    },
    {
      name: "iphone-webkit-critical",
      testMatch: "**/onboarding-delivery-flow.spec.ts",
      grep:
        /reaches the album after adding a real test candidate|shows the iPhone home-screen guide after daytime onboarding|offers a retry when the delivered onboarding photo cannot load|shows only the new received letter after a test reset/,
      use: {
        ...devices["iPhone 14"],
        browserName: "webkit",
      },
    },
  ],
});
