import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.STARTUP_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const label = process.env.STARTUP_CAPTURE_LABEL || "capture";
const outputDir = path.resolve(
  process.cwd(),
  "artifacts",
  "home-startup-transition-2026-07-11",
  label,
);
const frameTimes = [0, 100, 200, 350, 500, 700, 900, 1200, 1600, 2200, 3000];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  recordVideo: { dir: outputDir, size: { width: 402, height: 874 } },
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.floor((750 * 1024) / 8),
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await page.addInitScript(() => {
  window.__startupLayoutShift = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        window.__startupLayoutShift += entry.value;
      }
    }
  }).observe({ type: "layout-shift", buffered: true });

  const now = Date.parse("2026-07-11T09:00:00+09:00");
  window.__testNow = now;
  const profile = {
    id: "startup-cat",
    name: "むぎ",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  localStorage.setItem("active_cat_id", profile.id);
  localStorage.setItem("cat_profiles", JSON.stringify([profile]));
  localStorage.setItem("neteruneko_onboarding_completed", "true");
});

const startedAt = Date.now();
await page.goto(`${baseUrl}/home`, { waitUntil: "commit" });
const committedAt = Date.now();
const frames = [];

for (const targetMs of frameTimes) {
  const elapsed = Date.now() - committedAt;
  if (targetMs > elapsed) {
    await page.waitForTimeout(targetMs - elapsed);
  }
  const state = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const main = document.querySelector("main");
    return {
      elapsedMs: Math.round(performance.now()),
      rootBackground: root ? getComputedStyle(root).backgroundColor : "",
      bodyBackground: body ? getComputedStyle(body).backgroundColor : "",
      mainBackground: main ? getComputedStyle(main).backgroundColor : "",
      startupHold: Boolean(document.querySelector('[data-testid="home-startup-hold"]')),
      startupSkeleton: Boolean(
        document.querySelector('[data-testid="home-startup-skeleton"]'),
      ),
      homeModel: Boolean(document.querySelector('[data-testid="home-desk-model"]')),
      bottomNav: Boolean(document.querySelector("[data-app-bottom-nav]")),
      cls: window.__startupLayoutShift || 0,
    };
  });
  frames.push({ targetMs, ...state });
}

await page.waitForLoadState("networkidle");
const finalMetrics = await page.evaluate(() => {
  const navigation = performance.getEntriesByType("navigation")[0];
  return {
    cls: window.__startupLayoutShift || 0,
    responseStart: Math.round(navigation?.responseStart || 0),
    domContentLoaded: Math.round(navigation?.domContentLoadedEventEnd || 0),
    loadEventEnd: Math.round(navigation?.loadEventEnd || 0),
  };
});
const rawVideoPath = await page.video()?.path();
await context.close();
await browser.close();

if (rawVideoPath) {
  const videoPath = path.join(outputDir, `${label}-startup.webm`);
  const filmstripPath = path.join(outputDir, "filmstrip.png");
  await rename(rawVideoPath, videoPath);
  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-vf",
      "fps=5,scale=201:437,tile=5x6",
      "-frames:v",
      "1",
      filmstripPath,
    ],
    { encoding: "utf8" },
  );
  if (ffmpeg.status !== 0) {
    console.warn(ffmpeg.stderr || "filmstrip generation failed");
  }
}

const report = {
  label,
  url: `${baseUrl}/home`,
  throttle: "iPhone 16 Pro CSS viewport, DPR3, 4x CPU, approx 4G",
  wallClockTtfbMs: committedAt - startedAt,
  finalMetrics,
  frames,
};
await writeFile(
  path.join(outputDir, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
