import { chromium, devices } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "artifacts", "screenshots-2026-07-02");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3210";
const SHOULD_START_SERVER = !process.env.PLAYWRIGHT_BASE_URL;
const FIXED_DAY = "2026-07-02";
const CAT_ID = "cat-mugi-review";
const SECOND_CAT_ID = "cat-sora-review";
const REVIEW_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldmlldyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzUxNDEwODAwLCJleHAiOjE5MTcwMjUyMDB9.review";
const REVIEW_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldmlldyIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NTE0MTA4MDAsImV4cCI6MTkxNzAyNTIwMH0.review";

const imageOwn = svgDataUrl("むぎのねがお", "#f2ddc4", "#9b6945");
const imageOwn2 = svgDataUrl("きのうのねがお", "#e7dccd", "#6b5b4d");
const imageOwn3 = svgDataUrl("1週間前のねがお", "#f1eadf", "#7b6d5f");
const imageDelivered = svgDataUrl("どこかのねがお", "#dfe9ef", "#557486");
const imageGallery = svgDataUrl("この子の写真", "#e9dfd2", "#8b6f56");
const imageGallery2 = svgDataUrl("窓ぎわのむぎ", "#eadbd7", "#8b5f68");
const imageCollection = svgDataUrl("テーマ写真", "#e6e1ce", "#6d7553");

const results = [];
let devServer = null;

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  if (SHOULD_START_SERVER) {
    devServer = startDevServer();
    await waitForServer(BASE_URL);
  }

  const browser = await chromium.launch();
  try {
    await captureBatch(browser);
  } finally {
    await browser.close();
    if (devServer) {
      devServer.kill("SIGTERM");
    }
  }

  await fs.writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        results,
      },
      null,
      2,
    ),
    "utf8",
  );

  const okCount = results.filter((result) => result.status === "ok").length;
  const failed = results.filter((result) => result.status !== "ok");
  console.log(`Generated ${okCount}/${results.length} screenshots.`);
  if (failed.length) {
    console.log("Failed or skipped states:");
    for (const result of failed) {
      console.log(`- ${result.name}: ${result.reason}`);
    }
  }
  console.log(`Output: ${OUT_DIR}`);
}

async function captureBatch(browser) {
  await shot(browser, {
    name: "1-home-pre-capture",
    url: "/home",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedHome("pre-capture"),
  });
  await shot(browser, {
    name: "1-home-waiting",
    url: "/home",
    fixedTime: `${FIXED_DAY}T19:00:00+09:00`,
    seed: seedHome("waiting"),
  });
  await shot(browser, {
    name: "1-home-arrived-unopened",
    url: "/home",
    fixedTime: `${FIXED_DAY}T20:05:00+09:00`,
    seed: seedHome("arrived"),
  });
  await shot(browser, {
    name: "1-home-opened",
    url: "/home",
    fixedTime: `${FIXED_DAY}T20:10:00+09:00`,
    seed: seedHome("opened"),
  });
  await shot(browser, {
    name: "1-home-omoide-arrival",
    url: "/home",
    fixedTime: `${FIXED_DAY}T20:15:00+09:00`,
    seed: seedHome("omoide-arrival"),
  });
  await shot(browser, {
    name: "1-home-omoide-fullscreen",
    url: "/home",
    fixedTime: `${FIXED_DAY}T20:15:00+09:00`,
    seed: seedHome("omoide-arrival"),
    action: async (page) => {
      const letter = page.getByTestId("omoide-arrival-letter");
      if (await letter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await letter.click();
        await page.waitForTimeout(900);
      }
    },
  });
  await shot(browser, {
    name: "1-home-after-reset",
    url: "/home",
    fixedTime: `2026-07-03T05:10:00+09:00`,
    seed: seedHome("after-reset"),
  });

  await shot(browser, {
    name: "2-album-mainichi",
    url: "/collection",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
  });
  await shot(browser, {
    name: "2-album-monthboard",
    url: "/collection",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
    action: async (page) => {
      await page.getByTestId("mainichi-month-select").click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(350);
    },
  });
  await shot(browser, {
    name: "2-album-uchinoko",
    url: "/collection",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
    action: async (page) => {
      await clickText(page, /うちのこ|この子|写真/);
      await page.waitForTimeout(350);
    },
  });
  await shot(browser, {
    name: "2-album-photo-detail",
    url: "/collection",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
    action: async (page) => {
      const firstPhoto = page.locator("img").first();
      await firstPhoto.click({ timeout: 3000 }).catch(async () => {
        await page.getByTestId("mainichi-month-bundle-open").click({ timeout: 3000 }).catch(() => {});
      });
      await page.waitForTimeout(600);
    },
  });

  await shot(browser, {
    name: "3-cats-record",
    url: "/cats#omoide",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
  });
  await shot(browser, {
    name: "3-cats-year-sheet",
    url: "/cats",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
    action: async (page) => {
      await clickTestId(page, "cats-section-tab-record");
      await clickText(page, /2026年|年まとめ|月/);
      await page.waitForTimeout(500);
    },
  });
  await shot(browser, {
    name: "3-cats-photos-cat",
    url: "/cats",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
    action: async (page) => {
      await clickTestId(page, "cats-section-tab-photos");
      await page.waitForTimeout(400);
    },
  });
  await shot(browser, {
    name: "3-cats-photos-all",
    url: "/cats",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
    action: async (page) => {
      await clickTestId(page, "cats-section-tab-photos");
      await clickText(page, /ぜんぶ|すべて|全/);
      await page.waitForTimeout(400);
    },
  });
  await shot(browser, {
    name: "3-cats-basic-view",
    url: "/cats",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
    action: async (page) => {
      await clickTestId(page, "cats-section-tab-basic");
      await page.waitForTimeout(400);
    },
  });
  await shot(browser, {
    name: "3-cats-basic-edit",
    url: "/cats",
    fixedTime: `${FIXED_DAY}T13:00:00+09:00`,
    seed: seedRichAccount(),
    action: async (page) => {
      await clickTestId(page, "cats-section-tab-basic");
      await page.waitForTimeout(300);
      await clickText(page, /編集/);
      await page.waitForTimeout(500);
    },
  });

  await shot(browser, {
    name: "4-onboarding-step1",
    url: "/onboarding?source=review",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedFreshAccount({ onboardingCompleted: false }),
  });
  await shot(browser, {
    name: "4-onboarding-step2",
    url: "/onboarding?source=review",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedFreshAccount({ onboardingCompleted: false }),
    action: async (page) => {
      await clickText(page, /ねがおを1枚入れる|ねがお/);
      await page.waitForTimeout(500);
    },
  });
  await shot(browser, {
    name: "4-onboarding-step3",
    url: "/onboarding?source=review",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedOnboardingProgress("delivered"),
  });
  await shot(browser, {
    name: "4-onboarding-step4",
    url: "/onboarding?source=review",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedOnboardingProgress("saved"),
  });
  await shot(browser, {
    name: "4-fresh-home",
    url: "/home",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedFreshAccount(),
  });
  await shot(browser, {
    name: "4-fresh-album",
    url: "/collection",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedFreshAccount(),
  });
  await shot(browser, {
    name: "4-fresh-cats-record",
    url: "/cats",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedFreshAccount(),
  });
  await shot(browser, {
    name: "4-fresh-cats-basic",
    url: "/cats",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedFreshAccount(),
    action: async (page) => {
      await clickTestId(page, "cats-section-tab-basic");
      await page.waitForTimeout(400);
    },
  });
  await shot(browser, {
    name: "4-settings",
    url: "/settings",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedFreshAccount(),
  });
  await shot(browser, {
    name: "4-beta-supporter",
    url: "/settings",
    fixedTime: `${FIXED_DAY}T09:00:00+09:00`,
    seed: seedFreshAccount(),
    action: async (page) => {
      await clickText(page, /β|サポーター|応援/);
      await page.waitForTimeout(500);
    },
  });
}

async function shot(browser, { name, url, fixedTime, seed, action }) {
  const context = await browser.newContext({
    ...devices["iPhone 14"],
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const outputPath = path.join(OUT_DIR, `${name}.png`);

  try {
    await setupApiMocks(page);
    await installClock(page, fixedTime);
    await page.addInitScript((seedData) => {
      window.localStorage.clear();
      for (const [key, value] of Object.entries(seedData.localStorage)) {
        window.localStorage.setItem(key, value);
      }
      window.sessionStorage.clear();
    }, seed);

    await page.goto(`${BASE_URL}${url}`, { waitUntil: "domcontentloaded" });
    await settlePage(page, url);
    if (action) {
      await action(page);
      await settlePage(page, url, 900);
    }
    await page.screenshot({ path: outputPath, fullPage: true });
    results.push({ name, status: "ok", path: toArtifactPath(outputPath) });
  } catch (error) {
    results.push({
      name,
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await context.close();
  }
}

function toArtifactPath(value) {
  return path.relative(ROOT, value).split(path.sep).join("/");
}

async function setupApiMocks(page) {
  await page.route("**/api/presence", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: 124 }) }),
  );
  await page.route("**/api/billing/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ betaSupporter: false, subscription: null }),
    }),
  );
  await page.route("**/api/sleeping-delivery/exchange", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photo: exchangePhoto("mock-delivered", Date.parse(`${FIXED_DAY}T20:01:00+09:00`)),
        source: "remote",
        diagnostics: { source: "remote", candidateCount: 1 },
      }),
    }),
  );
  await page.route("**/api/sleeping-delivery/stock", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
  );
  await page.route("**/api/photo-storage/signed-url", async (route) => {
    const body = await route.request().postDataJSON().catch(() => ({}));
    const fallback = typeof body?.path === "string" && body.path.includes("gallery") ? imageGallery : imageOwn;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ signedUrl: fallback }),
    });
  });
}

async function installClock(page, fixedTime) {
  const timestamp = Date.parse(fixedTime);
  await page.addInitScript((now) => {
    const originalNow = Date.now.bind(Date);
    Date.now = () => now || originalNow();
    Object.defineProperty(window, "__testNow", {
      value: now,
      configurable: true,
    });
  }, timestamp);
  if (page.clock?.setFixedTime) {
    await page.clock.setFixedTime(new Date(timestamp)).catch(() => {});
  }
}

async function settlePage(page, url, extraWait = 0) {
  await page.waitForTimeout(4200 + extraWait);

  if (url.startsWith("/home")) {
    await page.getByTestId("home-desk-model").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  }
  if (url.startsWith("/cats")) {
    await page.getByTestId("cats-page").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  }
  if (url.startsWith("/collection")) {
    await page.getByTestId("mainichi-photo-board").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  }
}

function seedHome(kind) {
  const base = seedRichAccount();
  const now = Date.parse(`${FIXED_DAY}T20:05:00+09:00`);
  const own = ownSleepingPhoto("own-today", Date.parse(`${FIXED_DAY}T10:00:00+09:00`), imageOwn);
  const day = {
    dateKey: FIXED_DAY,
    targetOwnPhotoId: own.id,
    targetCatId: CAT_ID,
    targetCapturedAt: own.createdAt,
    targetPhoto: own,
  };

  if (kind === "pre-capture") {
    return seedFreshAccount();
  }
  if (kind === "waiting") {
    return withLocal(base, {
      nyaruhodo_exchange_own_sleeping_photos: [own],
      neteruneko_evening_delivery_days: { [FIXED_DAY]: day },
    });
  }
  if (kind === "arrived") {
    return withLocal(base, {
      nyaruhodo_exchange_own_sleeping_photos: [own],
      neteruneko_evening_delivery_days: {
        [FIXED_DAY]: {
          ...day,
          deliveredPhoto: exchangePhoto("delivered-today", now),
          deliveredAt: now,
        },
      },
    });
  }
  if (kind === "opened") {
    const delivered = exchangePhoto("delivered-today", now);
    return withLocal(base, {
      nyaruhodo_exchange_own_sleeping_photos: [own],
      nyaruhodo_exchange_kept_photos: [delivered],
      neteruneko_evening_delivery_days: {
        [FIXED_DAY]: {
          ...day,
          deliveredPhoto: delivered,
          deliveredAt: now,
          openedAt: now + 60_000,
          openedBy: "user",
          keptAt: now + 65_000,
        },
      },
    });
  }
  if (kind === "omoide-arrival") {
    return withLocal(base, {
      nyaruhodo_exchange_own_sleeping_photos: richOwnSleepingPhotos(),
      neteruneko_omoide_memories: {
        "omoide-arrival-review": omoideMemory({ opened: false }),
      },
    });
  }
  if (kind === "after-reset") {
    return withLocal(base, {
      nyaruhodo_exchange_own_sleeping_photos: richOwnSleepingPhotos(),
      neteruneko_evening_delivery_days: {
        [FIXED_DAY]: {
          ...day,
          deliveredPhoto: exchangePhoto("delivered-reset", now),
          deliveredAt: now,
          openedAt: Date.parse(`2026-07-03T05:00:00+09:00`),
          openedBy: "system",
        },
      },
    });
  }
  return base;
}

function seedRichAccount() {
  const profiles = [
    catProfile(CAT_ID, "むぎ", {
      familySinceDate: "2022-09-22",
      birthDate: "2022-07-10",
      gender: "male",
      breed: "ミックス",
      appearance: { coat: "orange_tabby", mixed: true },
      personality: {
        nickname: "むぎちゃん",
        favoritePlace: "窓ぎわ",
        favoritePlay: "ひも",
        favoriteTouch: "あごの下",
        dislikes: "掃除機",
      },
      care: {
        weightKg: 5.5,
        weightMeasuredDate: "2026-07-02",
        vetClinic: "○○動物病院",
        careNote: "鼻まわりをやさしく見る",
        vaccineDate: "2026-06-01",
        vaccineNote: "3種混合",
      },
    }),
    catProfile(SECOND_CAT_ID, "そら", {
      familySinceDate: "2024-01-12",
      gender: "female",
      appearance: { coat: "gray" },
    }),
  ];
  const ownPhotos = richOwnSleepingPhotos();
  const kept = [
    exchangePhoto("kept-1", Date.parse("2026-07-01T20:10:00+09:00")),
    exchangePhoto("kept-2", Date.parse("2026-06-30T20:10:00+09:00")),
  ];
  const gallery = [
    { id: "gallery-1", catId: CAT_ID, src: imageGallery, createdAt: Date.parse("2026-07-01T14:00:00+09:00") },
    { id: "gallery-2", catId: CAT_ID, src: imageGallery2, createdAt: Date.parse("2026-06-25T14:00:00+09:00") },
    { id: "gallery-3", catId: SECOND_CAT_ID, src: svgDataUrl("そらの写真", "#dde5e6", "#526b70"), createdAt: Date.parse("2026-06-20T14:00:00+09:00") },
  ];
  return withLocal(
    {
      localStorage: {
        onboarding_completed: "true",
        active_cat_id: CAT_ID,
        cat_profiles: JSON.stringify(profiles),
        nyaruhodo_exchange_own_sleeping_photos: JSON.stringify(ownPhotos),
        nyaruhodo_exchange_kept_photos: JSON.stringify(kept),
        neteruneko_cat_gallery_photos: JSON.stringify(gallery),
        collection_photos: JSON.stringify({
          [CAT_ID]: {
            pose_curled_sleep: [{ id: "collection-1", src: imageCollection, createdAt: "2026-07-01T10:00:00.000Z" }],
            pose_belly_sleep: [{ id: "collection-2", src: svgDataUrl("テーマ2", "#e5d5c7", "#805d47"), createdAt: "2026-06-27T10:00:00.000Z" }],
          },
        }),
        neteruneko_cat_sleeping_milestones: JSON.stringify({
          [CAT_ID]: [
            { target: 1, photoId: "own-1", src: imageOwn, reachedAt: Date.parse("2026-06-01T10:00:00+09:00") },
            { target: 10, photoId: "own-10", src: imageOwn2, reachedAt: Date.parse("2026-06-18T10:00:00+09:00") },
          ],
        }),
        neteruneko_omoide_memories: JSON.stringify({
          "omoide-opened-review": omoideMemory({ opened: true }),
        }),
      },
    },
    {},
  );
}

function seedFreshAccount({ onboardingCompleted = true } = {}) {
  return {
    localStorage: {
      onboarding_completed: onboardingCompleted ? "true" : "false",
      active_cat_id: CAT_ID,
      cat_profiles: JSON.stringify([catProfile(CAT_ID, "むぎ", {})]),
      nyaruhodo_exchange_own_sleeping_photos: "[]",
      nyaruhodo_exchange_kept_photos: "[]",
      neteruneko_cat_gallery_photos: "[]",
      collection_photos: "{}",
    },
  };
}

function seedOnboardingProgress(state) {
  const own = ownSleepingPhoto("onboarding-own", Date.parse(`${FIXED_DAY}T09:00:00+09:00`), imageOwn);
  const delivered = exchangePhoto("onboarding-delivered", Date.parse(`${FIXED_DAY}T09:02:00+09:00`));
  const progress = {
    state,
    ownPhoto: own,
    deliveredPhoto: delivered,
    createdAt: Date.parse(`${FIXED_DAY}T09:00:00+09:00`),
    updatedAt: Date.parse(`${FIXED_DAY}T09:02:00+09:00`),
  };
  return {
    localStorage: {
      onboarding_completed: "false",
      neteruneko_onboarding_progress: JSON.stringify(progress),
      nyaruhodo_exchange_own_sleeping_photos: JSON.stringify([own]),
      nyaruhodo_exchange_kept_photos: state === "saved" ? JSON.stringify([delivered]) : "[]",
      cat_profiles: "[]",
      active_cat_id: "",
    },
  };
}

function withLocal(seed, overrides) {
  const localStorage = { ...seed.localStorage };
  for (const [key, value] of Object.entries(overrides)) {
    localStorage[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return { localStorage };
}

function catProfile(id, name, basicInfo) {
  return {
    id,
    name,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    basicInfo,
    appearance: basicInfo.appearance ?? {},
  };
}

function richOwnSleepingPhotos() {
  return [
    ownSleepingPhoto("own-1", Date.parse("2026-06-01T09:00:00+09:00"), imageOwn),
    ownSleepingPhoto("own-2", Date.parse("2026-06-18T09:00:00+09:00"), imageOwn2),
    ownSleepingPhoto("own-3", Date.parse("2026-06-25T09:00:00+09:00"), imageOwn3),
    ownSleepingPhoto("own-4", Date.parse("2026-07-01T09:00:00+09:00"), imageOwn),
    ownSleepingPhoto("own-5", Date.parse("2026-07-02T09:00:00+09:00"), imageOwn2),
  ];
}

function ownSleepingPhoto(id, createdAt, src) {
  return {
    id,
    ownerCatId: CAT_ID,
    catId: CAT_ID,
    src,
    thumbnailSrc: src,
    displaySrc: src,
    originalSrc: src,
    state: "sleeping",
    visibility: "private",
    deliveryStatus: "available",
    triggerLabel: "sleeping",
    theme: "sleeping",
    shared: false,
    createdAt,
  };
}

function exchangePhoto(id, deliveredAt) {
  return {
    id,
    sourcePhotoId: `${id}-source`,
    src: imageDelivered,
    thumbnailSrc: imageDelivered,
    displaySrc: imageDelivered,
    originalSrc: imageDelivered,
    title: "",
    subtitle: "",
    triggerLabel: "sleeping",
    theme: "sleeping",
    deliveredAt,
  };
}

function omoideMemory({ opened }) {
  const deliveredAt = Date.parse(`${FIXED_DAY}T20:05:00+09:00`);
  const photo = ownSleepingPhoto("own-omoide-source", Date.parse("2026-06-25T09:00:00+09:00"), imageOwn3);
  return {
    id: opened ? "omoide-opened-review" : "omoide-arrival-review",
    catId: CAT_ID,
    catName: "むぎ",
    sourcePhotoId: photo.id,
    sourceDateKey: "2026-06-25",
    deliveryDateKey: FIXED_DAY,
    photo,
    lookback: "week",
    reason: "same_day",
    title: "1週間前の、きょう",
    subtitle: "窓ぎわで寝ていた日",
    voice: "この日も、よく眠っていました。",
    bridge: "また会いたくなる一枚です。",
    deliveredAt,
    ...(opened ? { openedAt: deliveredAt + 60_000 } : {}),
  };
}

async function clickTestId(page, testId) {
  const locator = page.getByTestId(testId);
  if (await locator.isVisible({ timeout: 2500 }).catch(() => false)) {
    await locator.click();
  }
}

async function clickText(page, pattern) {
  const locator = page.getByText(pattern).first();
  if (await locator.isVisible({ timeout: 2500 }).catch(() => false)) {
    await locator.click();
  }
}

function svgDataUrl(label, background, foreground) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
  <rect width="900" height="900" rx="64" fill="${background}"/>
  <circle cx="450" cy="390" r="170" fill="#fff8ef" opacity="0.95"/>
  <path d="M300 385c20-70 80-115 150-115s130 45 150 115c-48-38-252-38-300 0z" fill="${foreground}" opacity="0.32"/>
  <path d="M315 420c55 70 215 70 270 0 10 120-55 195-135 195s-145-75-135-195z" fill="#fff8ef"/>
  <path d="M340 330l55-80 35 95M560 330l-55-80-35 95" fill="${foreground}" opacity="0.45"/>
  <path d="M390 435c20 28 100 28 120 0" fill="none" stroke="${foreground}" stroke-width="12" stroke-linecap="round"/>
  <circle cx="385" cy="390" r="12" fill="${foreground}"/><circle cx="515" cy="390" r="12" fill="${foreground}"/>
  <text x="450" y="730" text-anchor="middle" font-family="sans-serif" font-size="54" fill="${foreground}">${escapeXml(label)}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function startDevServer() {
  const command =
    process.platform === "win32"
      ? "npm run start -- --port 3210"
      : "npm run start -- --port 3210";
  return spawn(command, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || REVIEW_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY || REVIEW_SERVICE_ROLE_KEY,
    },
  });
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Server is still warming up.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

main().catch((error) => {
  console.error(error);
  if (devServer) {
    devServer.kill("SIGTERM");
  }
  process.exit(1);
});
