import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

const DEFAULT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.APP_URL || "http://localhost:3000";
const baseUrl = String(process.env.AUDIT_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const routes = (process.env.AUDIT_ROUTES || "/home,/onboarding,/collection")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const outDir = process.env.AUDIT_OUT_DIR || "artifacts/prepost3-mobile-audit";
const runId = new Date().toISOString().replace(/[:.]/g, "-");

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["iPhone 14"],
});
const page = await context.newPage();
const client = await context.newCDPSession(page);

await client.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.floor((750 * 1024) / 8),
});
await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

const results = [];

for (const route of routes) {
  const url = `${baseUrl}${route.startsWith("/") ? route : `/${route}`}`;
  console.log(`[prepost3-mobile-audit] ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    const resources = performance
      .getEntriesByType("resource")
      .map((entry) => {
        const resource = entry;
        return {
          name: resource.name,
          initiatorType: resource.initiatorType,
          duration: Math.round(resource.duration),
          transferSize: resource.transferSize ?? 0,
          decodedBodySize: resource.decodedBodySize ?? 0,
        };
      })
      .sort((a, b) => b.transferSize - a.transferSize)
      .slice(0, 20);

    const unnamedButtons = Array.from(
      document.querySelectorAll('button, [role="button"]'),
    )
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        testId: element.getAttribute("data-testid") ?? "",
        text: element.textContent?.trim() ?? "",
        ariaLabel: element.getAttribute("aria-label") ?? "",
      }))
      .filter((button) => !button.text && !button.ariaLabel);

    const imagesWithoutAlt = Array.from(document.querySelectorAll("img"))
      .map((image) => ({
        src: image.currentSrc || image.src,
        alt: image.getAttribute("alt"),
        testId: image.closest("[data-testid]")?.getAttribute("data-testid") ?? "",
      }))
      .filter((image) => image.alt === null);

    const doc = document.documentElement;
    const horizontalOverflow = Math.max(0, doc.scrollWidth - doc.clientWidth);
    const totalTransferBytes = resources.reduce(
      (sum, resource) => sum + (resource.transferSize || 0),
      0,
    );

    return {
      title: document.title,
      url: location.href,
      totalTransferBytes,
      horizontalOverflow,
      unnamedButtons,
      imagesWithoutAlt,
      largestResources: resources.slice(0, 10),
    };
  });

  results.push(result);
}

await browser.close();

await mkdir(outDir, { recursive: true });
const outputPath = path.join(outDir, `${runId}.json`);
await writeFile(
  outputPath,
  JSON.stringify(
    {
      baseUrl,
      runId,
      generatedAt: new Date().toISOString(),
      throttle: "iPhone 14 viewport, Chrome CDP 4x CPU, approx 4G network",
      results,
    },
    null,
    2,
  ),
);

for (const result of results) {
  console.log(
    `[${new URL(result.url).pathname}] transfer=${result.totalTransferBytes}B overflow=${result.horizontalOverflow}px unnamedButtons=${result.unnamedButtons.length} imagesWithoutAlt=${result.imagesWithoutAlt.length}`,
  );
}
console.log(`[prepost3-mobile-audit] wrote ${outputPath}`);
