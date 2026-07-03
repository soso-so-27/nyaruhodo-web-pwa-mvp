import { expect, test, type Page } from "@playwright/test";

const ownDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

const deliveredDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";
const currentJstDateKey = getCurrentJstDateKey();
const beforeEightToday = getCurrentJstTime(19, 30);
const afterEightToday = getCurrentJstTime(20, 5);

test.describe("home desk model", () => {
  test("maps the five home states to desk shell states and presentation phases", async ({ page }) => {
    const expectedStates = {
      "1": { deskState: "1", phase: "empty-before" },
      "1b": { deskState: "1b", phase: "empty-after" },
      "2": { deskState: "2", phase: "sent-before" },
      "3": { deskState: "3", phase: "delivered" },
      "4": { deskState: "4", phase: "opened" },
    } as const;

    for (const state of ["1", "1b", "2", "3", "4"] as const) {
      await seedDeskState(page, state);
      await page.goto("/home");
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
        "data-state",
        expectedStates[state].deskState,
      );
      await expect(page.getByTestId("home-letter-tray")).toHaveAttribute(
        "data-phase",
        expectedStates[state].phase,
      );
    }
  });

  test("shows the steady state2 home frame and the today mini tile icon", async ({
    page,
  }) => {
    await seedDeskState(page, "2");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "2",
    );
    await expect(page.getByTestId("home-letter-tray")).toHaveAttribute(
      "data-phase",
      "sent-before",
    );
    await expect(page.getByTestId("desk-home-frame")).toBeVisible();
    await expect(page.getByText("おくった")).toBeVisible();
    await expect(page.getByText("よる8時に とどく").first()).toBeVisible();
    await expect(page.getByText("とっておきに のこす")).toBeVisible();
    await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    await expect(page.getByTestId("today-pair-nav-icon")).toBeVisible();
    await expect(page.getByTestId("today-pair-nav-slot")).toHaveCount(2);
    for (const slot of await page.getByTestId("today-pair-nav-slot").all()) {
      const box = await slot.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(8);
      expect(box?.height).toBeGreaterThanOrEqual(11);
    }
  });

  test("hydrates the clock-dependent home state without mismatch warnings", async ({
    page,
  }) => {
    const hydrationMessages: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        hydrationMessages.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      hydrationMessages.push(error.message);
    });

    await seedDeskState(page, "2", {
      now: getCurrentJstTime(19, 59) + 58_000,
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "2",
    );
    await expect(page.getByTestId("home-letter-tray")).toHaveAttribute(
      "data-phase",
      "sent-before",
    );
    expect(
      hydrationMessages.filter(
        (message) =>
          message.includes("Hydration failed") ||
          message.includes("DayCycleIndicator") ||
          message.includes("HomeInput"),
      ),
    ).toEqual([]);
  });

  test("shows only the active bottom navigation label", async ({ page }) => {
    await seedDeskState(page, "1");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const nav = page.getByRole("navigation", { name: "下部ナビゲーション" });
    await expect(nav.getByRole("link", { name: "きょう" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByText("きょう", { exact: true })).toBeVisible();
    await expect(nav.getByText("ねこだより", { exact: true })).toBeHidden();
    await expect(nav.getByText("うちのこ", { exact: true })).toBeHidden();

    await nav.getByRole("link", { name: "ねこだより" }).click();
    await expect(page).toHaveURL(/\/collection$/);
    const collectionNav = page.getByRole("navigation", {
      name: "下部ナビゲーション",
    });
    await expect(
      collectionNav.getByRole("link", { name: "きょう" }),
    ).not.toHaveAttribute("aria-current", "page");
    await expect(
      collectionNav.getByRole("link", { name: "ねこだより" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(collectionNav.getByText("ねこだより", { exact: true })).toBeVisible();
    await expect(collectionNav.getByText("きょう", { exact: true })).toBeHidden();
  });

  test("moves the home frame light by time without changing the state2 frame", async ({
    page,
  }) => {
    await seedDeskState(page, "2", { now: getCurrentJstTime(9, 0) });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const morningLight = await page
      .getByTestId("home-desk-model")
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--home-frame-light").trim(),
      );
    expect(morningLight).not.toEqual("");
    const morningFrameBox = await page.getByTestId("desk-home-frame").boundingBox();
    expect(morningFrameBox).not.toBeNull();

    await seedDeskState(page, "2", { now: getCurrentJstTime(18, 0) });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const eveningLight = await page
      .getByTestId("home-desk-model")
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--home-frame-light").trim(),
      );
    expect(eveningLight).not.toEqual("");
    expect(eveningLight).not.toEqual(morningLight);
    const eveningFrameBox = await page.getByTestId("desk-home-frame").boundingBox();
    expect(eveningFrameBox).not.toBeNull();
    expect(Math.round(eveningFrameBox!.width)).toBe(
      Math.round(morningFrameBox!.width),
    );
    expect(Math.round(eveningFrameBox!.height)).toBe(
      Math.round(morningFrameBox!.height),
    );
  });

  test("keeps the sent-before letter tray copy until the 20:00 delivery", async ({
    page,
  }) => {
    await seedDeskState(page, "2", { now: getCurrentJstTime(19, 59) });
    await mockDeskExchange(page);
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("もうすぐ、とどく")).toHaveCount(0);
    await expect(page.getByText("よる8時に とどく")).toBeVisible();

    await page.evaluate(() => {
      const [year, month, day] = new Date(Date.now() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
        .split("-")
        .map(Number);
      (window as typeof window & { __testNow?: number }).__testNow = Date.parse(
        new Date(Date.UTC(year, month - 1, day, 11, 0)).toISOString(),
      );
    });
    await expect(page.getByText("もうすぐ、とどく")).toHaveCount(0);
    await expect(page.getByText("よる8時に とどく")).toBeVisible();

    await page.evaluate(() => {
      const [year, month, day] = new Date(Date.now() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
        .split("-")
        .map(Number);
      (window as typeof window & { __testNow?: number }).__testNow = Date.parse(
        new Date(Date.UTC(year, month - 1, day, 11, 1)).toISOString(),
      );
      window.dispatchEvent(new Event("focus"));
    });
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "3",
    );
  });

  test("shows the sent-before line in habit mode without the waiting letter hint", async ({
    page,
  }) => {
    await seedDeskState(page, "2", {
      now: getCurrentJstTime(18, 0),
      keptExchangePhotoCount: 6,
      firstTargetDateKey: "2026-06-01",
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("もうすぐ、とどく")).toHaveCount(0);
    await expect(page.getByText("よる8時に とどく")).toBeVisible();
    await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    await expect(page.getByTestId("desk-letter-hint")).toHaveCount(0);
  });

  test("does not show the removed 2-second letter hint before 17:00", async ({ page }) => {
    await seedDeskState(page, "2", { now: getCurrentJstTime(15, 30) });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    await expect(page.getByTestId("desk-letter-hint")).toHaveCount(0);
  });

  test("shows a quiet state1 empty frame and capture CTA", async ({
    page,
  }) => {
    await seedDeskState(page, "1");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("きょうも すやすや")).toHaveCount(0);
    await expect(page.getByText("ねがおを とる")).toBeVisible();
    await expect(page.getByText("とると、よる8時に")).toBeVisible();
    await expect(page.getByText("ねこだよりが とどく")).toBeVisible();
    await expect(page.getByText("ねてない子は、アルバムへ")).toHaveCount(0);
    await expect(page.getByText("とっておきに のこす")).toHaveCount(0);
    await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    await expect(page.getByTestId("desk-empty-frame")).toHaveCSS(
      "border-style",
      "none",
    );
    await expect(page.getByTestId("desk-empty-frame")).toHaveCSS("cursor", "auto");
  });

  test("shows state1b as tomorrow capture without an exchange letter", async ({
    page,
  }) => {
    await seedDeskState(page, "1b");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1b",
    );
    await expect(page.getByTestId("desk-empty-frame")).toBeVisible();
    await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    await expect(page.getByText("きょうは とどかない")).toBeVisible();
    await expect(page.getByText("また あした")).toBeVisible();
  });

  test("keeps the home frame, tray, and bottom navigation separated", async ({
    page,
  }) => {
    const states = [
      { state: "1" as const, frameTestId: "desk-empty-frame" },
      { state: "2" as const, frameTestId: "desk-home-frame" },
      { state: "4" as const, frameTestId: "desk-home-frame" },
    ];

    for (const { state, frameTestId } of states) {
      await seedDeskState(page, state);
      await page.goto("/home");
      await page.waitForLoadState("networkidle");

      const frameBox = await page.getByTestId(frameTestId).boundingBox();
      const trayBox = await page.getByTestId("home-letter-tray").boundingBox();
      const navBox = await page
        .getByRole("navigation", { name: "下部ナビゲーション" })
        .boundingBox();

      expect(frameBox).not.toBeNull();
      expect(trayBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(Math.round(frameBox!.y + frameBox!.height)).toBeLessThanOrEqual(
        Math.round(trayBox!.y - 8),
      );
      expect(Math.round(trayBox!.y + trayBox!.height)).toBeLessThanOrEqual(
        Math.round(navBox!.y - 16),
      );
    }
  });

  test("keeps the home skeleton aligned on the 4px grid", async ({ page }) => {
    await seedDeskState(page, "1");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const emptyFrame = page.getByTestId("desk-empty-frame");
    const emptyAction = page.getByTestId("home-empty-action");
    const settings = page.getByTestId("home-settings-shortcut");
    const tray = page.getByTestId("home-letter-tray");
    const nav = page.getByRole("navigation", { name: "下部ナビゲーション" });

    const [frameBox, actionBox, settingsBox, trayBox, navBox] = await Promise.all([
      emptyFrame.boundingBox(),
      emptyAction.boundingBox(),
      settings.boundingBox(),
      tray.boundingBox(),
      nav.boundingBox(),
    ]);

    expect(frameBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(settingsBox).not.toBeNull();
    expect(trayBox).not.toBeNull();
    expect(navBox).not.toBeNull();

    expect(settingsBox?.width).toBe(36);
    expect(settingsBox?.height).toBe(36);
    expect(actionBox?.height).toBe(48);
    expect(navBox?.height).toBe(60);

    const centers = [frameBox!, trayBox!, navBox!].map(
      (box) => Math.round(box.x + box.width / 2),
    );
    expect(new Set(centers).size).toBe(1);

    const styles = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>(
        '[data-testid="desk-empty-frame"]',
      );
      const page = document.querySelector<HTMLElement>(
        '[data-testid="home-desk-model"]',
      );
      const action = document.querySelector<HTMLElement>(
        '[data-testid="home-empty-action"]',
      );
      const navElement = document.querySelector<HTMLElement>(
        'nav[aria-label="下部ナビゲーション"]',
      );

      return {
        frameGap: frame ? getComputedStyle(frame).gap : "",
        actionColumnGap: action ? getComputedStyle(action).columnGap : "",
        actionPaddingLeft: action ? getComputedStyle(action).paddingLeft : "",
        trayRadiusToken: page
          ? getComputedStyle(page).getPropertyValue("--home-tray-radius").trim()
          : "",
        navGap: navElement ? getComputedStyle(navElement).columnGap : "",
      };
    });

    expect(styles.frameGap).toBe("20px");
    expect(styles.actionColumnGap).toBe("8px");
    expect(styles.actionPaddingLeft).toBe("24px");
    expect(styles.trayRadiusToken).toBe("20px");
    expect(styles.navGap).toBe("4px");
  });

  test("keeps the settings shortcut clear of the sleeping photo zone", async ({
    page,
  }) => {
    for (const state of ["1", "2", "4"] as const) {
      await seedDeskState(page, state);
      await page.goto("/home");
      await page.waitForLoadState("networkidle");

      const zone = page.getByTestId(
        state === "1" ? "desk-empty-frame" : "desk-home-frame",
      );
      const settings = page.getByTestId("home-settings-shortcut");
      const [zoneBox, settingsBox] = await Promise.all([
        zone.boundingBox(),
        settings.boundingBox(),
      ]);

      expect(zoneBox).not.toBeNull();
      expect(settingsBox).not.toBeNull();
      expect(rectsOverlap(zoneBox!, settingsBox!)).toBe(false);
      expect(Math.round(settingsBox!.y + settingsBox!.height)).toBeLessThanOrEqual(
        Math.round(zoneBox!.y - 8),
      );
    }
  });

  test("opens the delivered envelope after a tap animation", async ({ page }) => {
    await page.addInitScript(() => {
      (window as typeof window & { __openSoundCallCount?: number })
        .__openSoundCallCount = 0;
      window.addEventListener("neteruneko:open-sound-play-requested", () => {
        (window as typeof window & { __openSoundCallCount?: number })
          .__openSoundCallCount =
          ((window as typeof window & { __openSoundCallCount?: number })
            .__openSoundCallCount ?? 0) + 1;
      });
    });
    await seedDeskState(page, "3");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const letter = page.getByTestId("desk-open-letter");
    const box = await letter.boundingBox();
    expect(box).not.toBeNull();
    await expect(letter.locator('[data-envelope-motion-root="true"]')).toHaveCount(0);
    await expect(letter.locator('[data-envelope-art="simple"]')).toHaveCount(1);
    await expect(letter.locator('[data-develop-photo="true"]')).toHaveCount(0);

    await letter.click();
    await page.waitForTimeout(250);
    await expect(letter.locator('[data-develop-photo="true"]')).toHaveCount(0);
    await expect(letter.locator('[data-envelope-art="simple"]')).toHaveCount(0);

    const openingPair = page.getByTestId("evening-opening-pair");
    await expect(openingPair.getByText("ねこだより")).toBeVisible();
    await expect(openingPair.locator("img")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "閉じる" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __openSoundCallCount?: number })
              .__openSoundCallCount ?? 0,
        ),
      )
      .toBe(1);
  });

  test("hides week-one copy after the habit threshold", async ({ page }) => {
    await seedDeskState(page, "1", {
      keptExchangePhotoCount: 6,
      firstTargetDateKey: "2026-06-01",
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );
    await expect(page.getByText("むぎ、ねてる?")).toHaveCount(0);
  });

  test("omits visible photo labels in the opened pair", async ({ page }) => {
    await seedDeskState(page, "4");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
    await expect(page.getByText(/\u3069\u3053\u304b\u306e\u3053/)).toHaveCount(0);
    await expect(page.getByTestId("evening-opening-pair")).toHaveCount(0);
  });

  test("hides desk labels after the habit threshold", async ({ page }) => {
    await seedDeskState(page, "4", {
      keptExchangePhotoCount: 6,
      firstTargetDateKey: "2026-06-01",
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
    await expect(page.getByText(/\u3069\u3053\u304b\u306e\u3053/)).toHaveCount(0);
    await expect(page.getByTestId("evening-opening-pair")).toHaveCount(0);
  });

  test("keeps state4 focused on the latest own cat photo", async ({
    page,
  }) => {
    await seedDeskState(page, "4");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
    await expect(page.getByTestId("desk-home-frame")).toBeVisible();
    await expect(page.getByText("きょうの ねこだより")).toBeVisible();
    await expect(page.getByRole("button", { name: "とっておく" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "どこかのこの写真を大きく見る" }),
    ).toHaveCount(0);
  });

  test("does not show the removed yesterday mini on home", async ({
    page,
  }) => {
    await seedDeskState(page, "1", { withYesterday: true });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByLabel("きのうの2まい")).toHaveCount(0);
  });

  test("does not attach motion classes when reduced motion is enabled", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedDeskState(page, "1");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".desk-frame-breathe")).toHaveCount(0);
  });

  test("delivers a past sleeping photo as an omoide letter and keeps it in the cat tab", async ({
    page,
  }) => {
    await seedDeskState(page, "1b", {
      withOmoideCandidate: true,
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("omoide-arrival-letter")).toBeVisible();
    await page.getByTestId("omoide-arrival-letter").click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/cats#omoide$/);
    const bunbako = page.getByTestId("omoide-bunbako");
    await expect(bunbako).toBeVisible();
    await expect(bunbako.getByText("とどいた思い出")).toBeVisible();
    await expect(bunbako.getByText("1週間前の、きょう。")).toBeVisible();
  });
});

function rectsOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

async function seedDeskState(
  page: Page,
  state: "1" | "1b" | "2" | "3" | "4",
  options: {
    now?: number;
    keptExchangePhotoCount?: number;
    firstTargetDateKey?: string;
    withYesterday?: boolean;
    withOmoideCandidate?: boolean;
  } = {},
) {
  const now =
    options.now ??
    (state === "1b"
      ? afterEightToday
      : state === "3" || state === "4"
        ? afterEightToday
        : beforeEightToday);

  await page.addInitScript(
    ({
      now,
      state,
      ownDataUrl,
      deliveredDataUrl,
      options,
      dateKeyValue,
      beforeEightValue,
    }) => {
      (window as typeof window & { __testNow?: number }).__testNow = now;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();

      if (!window.location.pathname.startsWith("/home")) {
        return;
      }

      const catId = "cat-desk";
      const dateKey = dateKeyValue;
      const capturedAt =
        state === "3" || state === "4"
          ? beforeEightValue
          : now;
      const ownPhoto = {
        id: "own-desk",
        ownerCatId: catId,
        catId,
        src: ownDataUrl,
        state: "sleeping",
        visibility: "private",
        deliveryStatus: "available",
        triggerLabel: "sleeping",
        theme: "sleeping",
        shared: false,
        createdAt: capturedAt,
      };
      const deliveredPhoto = {
        id: "delivered-desk",
        sourcePhotoId: "source-desk",
        src: deliveredDataUrl,
        title: "",
        subtitle: "",
        triggerLabel: "sleeping",
        theme: "sleeping",
        deliveredAt: now,
      };
      const store: Record<string, unknown> = {};

      window.localStorage.clear();
      window.localStorage.setItem("neteruneko_home_desk_model", "1");
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", catId);
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: catId,
            name: "むぎ",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ]),
      );

      const ownPhotos = state === "1" || state === "1b" ? [] : [ownPhoto];
      const omoidePhoto = {
        ...ownPhoto,
        id: "own-omoide-week",
        createdAt: beforeEightValue - 7 * 24 * 60 * 60 * 1000,
      };
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify(options.withOmoideCandidate ? [omoidePhoto, ...ownPhotos] : ownPhotos),
      );

      if (state === "2" || state === "3" || state === "4") {
        store[dateKey] = {
          dateKey,
          targetOwnPhotoId: ownPhoto.id,
          targetCatId: catId,
          targetCapturedAt: capturedAt,
          targetPhoto: ownPhoto,
          ...(state === "3" || state === "4"
            ? { deliveredPhoto, deliveredAt: now }
            : {}),
          ...(state === "4" ? { openedAt: now + 1000 } : {}),
        };
      }

      if (options.firstTargetDateKey) {
        store[options.firstTargetDateKey] = {
          dateKey: options.firstTargetDateKey,
          targetOwnPhotoId: "first-target",
          targetCatId: catId,
          targetCapturedAt: Date.parse("2026-06-01T03:00:00.000Z"),
          skippedAt: Date.parse("2026-06-02T03:00:00.000Z"),
        };
      }

      if (options.withYesterday) {
        const yesterdayPhoto = {
          ...ownPhoto,
          id: "own-yesterday",
          createdAt: Date.parse("2026-06-09T03:00:00.000Z"),
        };
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([yesterdayPhoto]),
        );
        store["2026-06-09"] = {
          dateKey: "2026-06-09",
          targetOwnPhotoId: yesterdayPhoto.id,
          targetCatId: catId,
          targetCapturedAt: yesterdayPhoto.createdAt,
          targetPhoto: yesterdayPhoto,
          skippedAt: Date.parse("2026-06-10T11:00:00.000Z"),
        };
      }

      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify(store),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify(
          Array.from({ length: options.keptExchangePhotoCount ?? 0 }, (_, index) => ({
            ...deliveredPhoto,
            id: `kept-${index}`,
            sourcePhotoId: `source-${index}`,
          })),
        ),
      );
    },
    {
      now,
      state,
      ownDataUrl,
      deliveredDataUrl,
      options,
      dateKeyValue: currentJstDateKey,
      beforeEightValue: beforeEightToday,
    },
  );

  await page.route("/api/presence", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 124 }),
    });
  });
}

function getCurrentJstDateKey() {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentJstTime(hour: number, minute: number) {
  const [year, month, day] = currentJstDateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day, hour - 9, minute);
}

async function mockDeskExchange(page: Page) {
  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photo: {
          id: "delivered-desk-from-exchange",
          sourcePhotoId: "source-desk-from-exchange",
          src: deliveredDataUrl,
          title: "",
          subtitle: "",
          triggerLabel: "sleeping",
          theme: "sleeping",
          deliveredAt: Date.parse("2026-06-10T11:00:00.000Z"),
        },
        source: "remote",
        diagnostics: {
          source: "remote",
          candidateCount: 1,
          normalCandidateCount: 1,
          fallbackCandidateCount: 0,
          fallbackActive: false,
        },
      }),
    });
  });
}
