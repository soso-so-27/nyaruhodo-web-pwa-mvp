import { expect, test, type Page } from "@playwright/test";

const ownDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

const deliveredDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";
const currentJstDateKey = getCurrentJstDateKey();
const beforeEightToday = getCurrentJstTime(19, 30);
const afterEightToday = getCurrentJstTime(20, 5);

test.describe("home desk model", () => {
  test("serves a stable home skeleton before client state hydrates", async ({
    request,
  }) => {
    for (const route of ["/", "/home"]) {
      const response = await request.get(route);
      expect(response.ok()).toBe(true);
      const html = await response.text();

      expect(html).toContain('data-testid="home-startup-skeleton"');
      expect(html).not.toContain("startup-envelope-hold-1206-2622-v1.webp");
      expect(html).not.toContain("Googleでつづける");
      expect(html).not.toContain("ログイン");
    }
  });

  test("keeps src attribution on the statically served root route", async ({
    page,
  }) => {
    await page.route("**/rest/v1/**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 500,
        body: JSON.stringify({ error: "keep analytics queued locally" }),
      });
    });

    await page.goto("/?src=instagram_bio");
    await expect(page.getByTestId("home-desk-model")).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const events = JSON.parse(
            window.localStorage.getItem("analytics_event_queue") ?? "[]",
          ) as Array<{ name?: string; properties?: Record<string, unknown> }>;
          return events.find((event) => event.name === "app_opened")?.properties;
        }),
      )
      .toMatchObject({
        source: "instagram_bio",
        source_param: "instagram_bio",
        src: "instagram_bio",
      });
  });

  test("uses a neutral skeleton before restoring a completed handoff home", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem(
        "neteruneko_onboarding_progress",
        JSON.stringify({
          version: 1,
          anonymousId: "static-handoff-user",
          dateKey: "2026-07-11",
          stage: "album_created",
          source: "handoff",
          updatedAt: Date.now(),
        }),
      );
    });

    const response = await page.request.get("/home?handoff=restored");
    const html = await response.text();
    expect(html).toContain('data-testid="home-startup-skeleton"');
    expect(html).not.toContain("Googleでつづける");
    expect(html).not.toContain("ログイン");

    await page.goto("/home?handoff=restored");
    await expect(page.getByTestId("home-desk-model")).toBeVisible();
    await expect(page.getByTestId("home-startup-skeleton")).toHaveCount(0);
    await expect(page.getByText("Googleでつづける")).toHaveCount(0);
  });

  test("maps the five home states to desk shell states and presentation phases", async ({ page }) => {
    const expectedStates = {
      "1": { deskState: "1", phase: null },
      "1b": { deskState: "1b", phase: "empty-after" },
      "2": { deskState: "2", phase: "sent-before" },
      "3": { deskState: "3", phase: "delivered" },
      "4": { deskState: "4", phase: null },
    } as const;

    for (const state of ["1", "1b", "2", "3", "4"] as const) {
      await seedDeskState(page, state);
      await page.goto("/home");
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
        "data-state",
        expectedStates[state].deskState,
      );
      if (expectedStates[state].phase) {
        await expect(page.getByTestId("home-letter-tray")).toHaveAttribute(
          "data-phase",
          expectedStates[state].phase,
        );
      } else {
        await expect(page.getByTestId("home-letter-tray")).toHaveCount(0);
      }
    }
  });

  test("keeps the notification tray limited to unopened items across night states", async ({
    page,
  }) => {
    const states = [
      {
        state: "1b" as const,
        name: "empty-after",
        expectedDeliveryLetters: 0,
        expectedTrayWithoutOmoide: true,
      },
      {
        state: "2" as const,
        name: "waiting-after-eight",
        expectedDeliveryLetters: 0,
        expectedTrayWithoutOmoide: true,
      },
      {
        state: "3" as const,
        name: "delivery-unopened",
        expectedDeliveryLetters: 1,
        expectedTrayWithoutOmoide: true,
      },
      {
        state: "4" as const,
        name: "delivery-opened",
        expectedDeliveryLetters: 0,
        expectedTrayWithoutOmoide: false,
      },
    ];

    for (const withOmoide of [false, true]) {
      for (const scenario of states) {
        if (scenario.state === "2") {
          await mockDeskExchangeEmpty(page);
        }
        await seedDeskState(page, scenario.state, {
          now: afterEightToday,
          withStoredOmoide: withOmoide,
        });
        await page.goto(`/home?matrix=${scenario.name}-${withOmoide ? "omoide" : "plain"}`);
        await page.waitForLoadState("networkidle");

        const tray = page.getByTestId("home-letter-tray");
        const shouldShowTray = scenario.expectedTrayWithoutOmoide;
        await expect(tray).toHaveCount(shouldShowTray ? 1 : 0);
        await expect(page.getByTestId("desk-open-letter")).toHaveCount(
          scenario.expectedDeliveryLetters,
        );
        await expect(page.getByTestId("omoide-arrival-letter")).toHaveCount(0);
        await expect(page.getByTestId("cats-nav-unopened-omoide-dot")).toHaveCount(
          withOmoide ? 1 : 0,
        );

        if (shouldShowTray) {
          await expect(tray.locator('a[href="/collection"]')).toHaveCount(0);
        }
      }
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
    await expect(page.getByTestId("home-retake-action")).toBeVisible();
    await expect(page.getByTestId("home-retake-action")).toHaveText("とりなおす");
    await expect(
      page.getByText("きょうの一枚。よる8時のねこだよりに"),
    ).toHaveCount(0);
    await expect(page.getByText("この子の写真をしまう")).toHaveCount(0);
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
    await expect(page.getByText("きょうの一枚。よる8時のねこだよりに")).toBeVisible();
    await expect(page.getByText("ねてない子は、アルバムへ")).toHaveCount(0);
    await expect(page.getByText("この子の写真をしまう")).toHaveCount(0);
    await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    await expect(page.getByTestId("desk-empty-frame")).toHaveCSS(
      "border-style",
      "none",
    );
    await expect(page.getByTestId("desk-empty-frame")).toHaveCSS("cursor", "auto");
  });

  test("adapts the b3 ink trace across the four ambient periods", async ({
    context,
  }) => {
    const periods = [
      { name: "morning", now: getCurrentJstTime(7, 0) },
      { name: "noon", now: getCurrentJstTime(12, 0) },
      { name: "evening", now: getCurrentJstTime(17, 0) },
      { name: "night", now: getCurrentJstTime(22, 0) },
    ];
    const inkColors: string[] = [];

    for (const period of periods) {
      const periodPage = await context.newPage();
      await seedDeskState(periodPage, "1", { now: period.now });
      await periodPage.goto("/home?illust=b3-ink");
      await periodPage.waitForLoadState("networkidle");

      const inkCat = periodPage.getByTestId("home-b3-ink-cat");
      await expect(inkCat).toBeVisible();
      inkColors.push(await inkCat.evaluate((element) => getComputedStyle(element).backgroundColor));
      await periodPage.screenshot({
        path: `artifacts/cat-illustration-b-variants/b3-ink-${period.name}.png`,
        fullPage: true,
      });
      await periodPage.close();
    }

    expect(new Set(inkColors).size).toBe(4);
  });

  test("adapts the d1 silhouette across the four ambient periods", async ({
    context,
  }) => {
    const periods = [
      { name: "morning", now: getCurrentJstTime(7, 0) },
      { name: "noon", now: getCurrentJstTime(12, 0) },
      { name: "evening", now: getCurrentJstTime(17, 0) },
      { name: "night", now: getCurrentJstTime(22, 0) },
    ];
    const inkColors: string[] = [];

    for (const period of periods) {
      const periodPage = await context.newPage();
      await seedDeskState(periodPage, "1", { now: period.now });
      await periodPage.goto("/home?illust=d1-ink");
      await periodPage.waitForLoadState("networkidle");

      const inkCat = periodPage.getByTestId("home-d1-ink-cat");
      await expect(inkCat).toBeVisible();
      inkColors.push(await inkCat.evaluate((element) => getComputedStyle(element).backgroundColor));
      await periodPage.screenshot({
        path: `artifacts/cat-illustration-d-silhouette/d1-ink-${period.name}.png`,
        fullPage: true,
      });
      await periodPage.close();
    }

    expect(new Set(inkColors).size).toBe(4);
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
    await seedDeskState(page, "1");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const emptyFrameBox = await page.getByTestId("desk-empty-frame").boundingBox();
    const emptyNavBox = await page
      .getByRole("navigation", { name: "下部ナビゲーション" })
      .boundingBox();

    await expect(page.getByTestId("home-letter-tray")).toHaveCount(0);
    expect(emptyFrameBox).not.toBeNull();
    expect(emptyNavBox).not.toBeNull();
    expect(Math.round(emptyFrameBox!.y + emptyFrameBox!.height)).toBeLessThanOrEqual(
      Math.round(emptyNavBox!.y - 16),
    );

    await seedDeskState(page, "2");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const frameBox = await page.getByTestId("desk-home-frame").boundingBox();
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

    await seedDeskState(page, "4");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    const openedFrameBox = await page.getByTestId("desk-home-frame").boundingBox();
    const openedNavBox = await page
      .getByRole("navigation", { name: "下部ナビゲーション" })
      .boundingBox();

    await expect(page.getByTestId("home-letter-tray")).toHaveCount(0);
    expect(openedFrameBox).not.toBeNull();
    expect(openedNavBox).not.toBeNull();
    expect(Math.round(openedFrameBox!.y + openedFrameBox!.height)).toBeLessThanOrEqual(
      Math.round(openedNavBox!.y - 16),
    );
  });

  test("keeps the home skeleton aligned on the 4px grid", async ({ page }) => {
    await seedDeskState(page, "1");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const emptyFrame = page.getByTestId("desk-empty-frame");
    const emptyAction = page.getByTestId("home-empty-action");
    const settings = page.getByTestId("home-settings-shortcut");
    const nav = page.getByRole("navigation", { name: "下部ナビゲーション" });

    await expect(page.getByTestId("home-letter-tray")).toHaveCount(0);
    const [frameBox, actionBox, settingsBox, navBox] = await Promise.all([
      emptyFrame.boundingBox(),
      emptyAction.boundingBox(),
      settings.boundingBox(),
      nav.boundingBox(),
    ]);

    expect(frameBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(settingsBox).not.toBeNull();
    expect(navBox).not.toBeNull();

    expect(settingsBox?.width).toBe(36);
    expect(settingsBox?.height).toBe(36);
    expect(actionBox?.height).toBe(48);
    expect(navBox?.height).toBe(60);

    const centers = [frameBox!, navBox!].map(
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
    await expect(openingPair).toContainText(
      "この一通は、『とどいた』にしまわれました",
    );
    await expect(openingPair.getByRole("button", { name: "閉じる" })).toHaveCount(
      0,
    );
    await expect(openingPair.locator("button")).toHaveCount(1);
    await expect(
      openingPair.getByRole("button", { name: "とじる" }),
    ).toBeVisible();
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

  test("shows the opened home as the normal photo frame without the old stamp pair", async ({ page }) => {
    await seedDeskState(page, "4");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
    await expect(page.getByTestId("desk-home-frame")).toBeVisible();
    await expect(page.getByTestId("home-stamp-pair")).toHaveCount(0);
    await expect(page.getByTestId("home-stamp-pair-stamp")).toHaveCount(0);
    await expect(page.getByText(/\u3069\u3053\u304b\u306e\u3053/)).toHaveCount(0);
    await expect(page.getByTestId("evening-opening-pair")).toHaveCount(0);
  });

  test("does not revive the old opened stamp pair when today's own photo is missing", async ({
    page,
  }) => {
    await seedDeskState(page, "4", { withoutOwnPhoto: true });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
    await expect(page.getByTestId("home-stamp-pair")).toHaveCount(0);
    await expect(page.getByTestId("home-stamp-pair-stamp")).toHaveCount(0);
  });

  test("starts decoding the delivered photo while the unopened letter is visible", async ({
    page,
  }) => {
    await seedDeskState(page, "3");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const letter = page.getByTestId("desk-open-letter");
    await expect(letter).toHaveAttribute("data-photo-decode", /loading|ready/);
    await expect
      .poll(() => letter.getAttribute("data-photo-decode"))
      .toBe("ready");
  });

  test("closes the opening overlay immediately without a flyer when motion is reduced", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedDeskState(page, "3");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("desk-open-letter").click();
    const openingPair = page.getByTestId("evening-opening-pair");
    await expect(openingPair).toBeVisible();
    await expect(openingPair.getByRole("button", { name: "閉じる" })).toHaveCount(
      0,
    );
    await openingPair.getByRole("button", { name: "とじる" }).click();

    await expect(page.getByTestId("evening-opening-flyer")).toHaveCount(0);
    await expect(page.getByTestId("evening-opening-pair")).toHaveCount(0);
    await expect(page.getByTestId("desk-home-frame")).toBeVisible();
    await expect(page.getByTestId("home-stamp-pair-stamp")).toHaveCount(0);
  });

  test("closes the opening overlay back to the normal home frame", async ({ page }) => {
    await seedDeskState(page, "3");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("desk-open-letter").click();
    const openingPair = page.getByTestId("evening-opening-pair");
    await expect(openingPair).toBeVisible();
    await expect(openingPair.getByRole("button", { name: "閉じる" })).toHaveCount(
      0,
    );
    await openingPair.getByRole("button", { name: "とじる" }).click();

    const flyer = page.getByTestId("evening-opening-flyer");
    await expect(flyer).toHaveCount(0);
    await expect(page.getByTestId("evening-opening-pair")).toHaveCount(0);
    await expect(page.getByTestId("desk-home-frame")).toBeVisible();
    await expect(page.getByTestId("home-stamp-pair-stamp")).toHaveCount(0);
  });

  test("shows system-opened deliveries directly as the normal opened home frame", async ({
    page,
  }) => {
    await seedDeskState(page, "4", { openedBySystem: true });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
    await expect(page.getByTestId("evening-opening-pair")).toHaveCount(0);
    await expect(page.getByTestId("desk-home-frame")).toBeVisible();
    await expect(page.getByTestId("home-stamp-pair-stamp")).toHaveCount(0);
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

  test("opens the same own photo that is visible in the state4 home frame", async ({
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
    const letterTray = page.getByTestId("home-letter-tray");
    await expect(letterTray).toHaveCount(0);
    await expect(page.getByRole("button", { name: "しまう" })).toHaveCount(0);
    await expect(
      letterTray.getByRole("button", { name: "どこかのこの写真を大きく見る" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("home-stamp-pair-stamp")).toHaveCount(0);
    const frame = page.getByTestId("desk-home-frame");
    await expect(frame).toHaveAttribute("data-photo-id", "own-desk");
    await frame.click();
    const viewer = page.getByTestId("desk-photo-viewer");
    await expect(viewer).toBeVisible();
    await expect(viewer).toHaveAttribute("data-photo-kind", "own");
    await expect(viewer).toHaveAttribute("data-photo-id", "own-desk");
    await expect(viewer.getByRole("button", { name: "とじる" })).toBeVisible();
    await expect(viewer.getByTestId("desk-photo-viewer-stow")).toHaveCount(0);
  });

  test("stows a tapped delivered photo and only shows close after it is stored", async ({
    page,
  }) => {
    await seedDeskState(page, "3");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("desk-open-letter").click();
    const openingPair = page.getByTestId("evening-opening-pair");
    await expect(openingPair).toBeVisible();
    await expect(openingPair).toHaveAttribute("data-photo-id", "delivered-desk");
    const closeButton = openingPair.getByTestId("evening-opening-tomorrow");
    await expect(closeButton).toHaveAttribute("data-stow-state", "stowed");
    await expect(closeButton).toHaveText("とじる");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const kept = JSON.parse(
            localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]",
          ) as Array<{ id?: string }>;
          const days = JSON.parse(
            localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
          ) as Record<string, { keptAt?: number }>;
          return {
            kept: kept.some((photo) => photo.id === "delivered-desk"),
            marked: Object.values(days).some((day) => typeof day.keptAt === "number"),
          };
        }),
      )
      .toEqual({ kept: true, marked: true });

    await closeButton.click();
    await expect(openingPair).toHaveCount(0);
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

  test("marks unopened omoide on the cats tab and opens it from today's pickup", async ({
    page,
  }) => {
    await seedDeskState(page, "1b", {
      withOmoideCandidate: true,
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("omoide-arrival-letter")).toHaveCount(0);
    await expect(page.getByTestId("cats-nav-unopened-omoide-dot")).toBeVisible();

    await page.goto("/cats");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("cats-nav-unopened-omoide-dot")).toBeVisible();
    await expect(page.getByTestId("cats-pickup-unopened-omoide-dot")).toBeVisible();

    await page.getByTestId("cats-pickup-section").locator("button").click();
    await expect(page.getByTestId("omoide-memory-viewer")).toBeVisible();
    await expect(page.getByTestId("omoide-memory-date")).toBeVisible();
    await expect(page.getByTestId("omoide-memory-stow")).toBeVisible();
    await expect(page.getByTestId("omoide-memory-cue")).toHaveCount(0);
    await expect(page.getByTestId("cats-nav-unopened-omoide-dot")).toHaveCount(0);
    await expect(page.getByTestId("cats-pickup-unopened-omoide-dot")).toHaveCount(0);
    await page.mouse.click(12, 12);
    await expect(page.getByTestId("omoide-memory-viewer")).toHaveCount(0);

    await page.goto("/cats#omoide");
    await page.waitForLoadState("networkidle");
    const bunbako = page.getByTestId("omoide-bunbako");
    await expect(bunbako).toBeVisible();
    await expect(bunbako.getByText("思い出箱")).toBeVisible();
    await expect(bunbako.getByText("1週間前の、きょう。")).toBeVisible();
  });

  test("keeps an already used source photo out of a new omoide delivery", async ({
    page,
  }) => {
    await seedDeskState(page, "1b", {
      withOmoideCandidate: true,
      usedOmoideSourcePhotoIds: ["own-omoide-week"],
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("neteruneko_omoide_memories"),
        ),
      )
      .toBeNull();
  });

  test("hides unopened omoide while receiving is disabled without deleting it", async ({
    page,
  }) => {
    await seedDeskState(page, "1b", {
      withStoredOmoide: true,
      omoideDisabled: true,
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("cats-nav-unopened-omoide-dot")).toHaveCount(0);

    await page.goto("/cats");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("cats-pickup-unopened-omoide-dot")).toHaveCount(0);
    await expect(page.getByTestId("omoide-bunbako")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem("neteruneko_omoide_memories");
          return raw ? Object.keys(JSON.parse(raw)).length : 0;
        }),
      )
      .toBe(1);
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
    withStoredOmoide?: boolean;
    usedOmoideSourcePhotoIds?: string[];
    omoideDisabled?: boolean;
    withoutOwnPhoto?: boolean;
    openedBySystem?: boolean;
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

      const ownPhotos =
        state === "1" || state === "1b" || options.withoutOwnPhoto
          ? []
          : [ownPhoto];
      const omoidePhoto = {
        ...ownPhoto,
        id: "own-omoide-week",
        createdAt: beforeEightValue - 7 * 24 * 60 * 60 * 1000,
      };
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify(options.withOmoideCandidate ? [omoidePhoto, ...ownPhotos] : ownPhotos),
      );
      if (options.omoideDisabled || options.usedOmoideSourcePhotoIds) {
        window.localStorage.setItem(
          "neteruneko_omoide_memory_controls",
          JSON.stringify({
            disabled: options.omoideDisabled === true,
            usedSourcePhotoIds: options.usedOmoideSourcePhotoIds ?? [],
          }),
        );
      } else {
        window.localStorage.removeItem("neteruneko_omoide_memory_controls");
      }

      if (state === "2" || state === "3" || state === "4") {
        store[dateKey] = {
          dateKey,
          targetOwnPhotoId: ownPhoto.id,
          targetCatId: catId,
          targetCapturedAt: capturedAt,
          ...(options.withoutOwnPhoto ? {} : { targetPhoto: ownPhoto }),
          ...(state === "3" || state === "4"
            ? { deliveredPhoto, deliveredAt: now }
            : {}),
          ...(state === "4"
            ? {
                openedAt: now + 1000,
                openedBy: options.openedBySystem ? "system" : "user",
              }
            : {}),
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

      if (options.withStoredOmoide) {
        const memoryPhoto = {
          ...omoidePhoto,
          src: deliveredDataUrl,
          displaySrc: deliveredDataUrl,
          thumbnailSrc: deliveredDataUrl,
        };
        window.localStorage.setItem(
          "neteruneko_omoide_memories",
          JSON.stringify({
            "omoide-desk-stored": {
              id: "omoide-desk-stored",
              catId,
              catName: "むぎ",
              sourcePhotoId: memoryPhoto.id,
              sourceDateKey: "2026-06-03",
              deliveryDateKey: dateKey,
              photo: memoryPhoto,
              lookback: "week",
              reason: "same_day",
              title: "1週間前の、きょう",
              subtitle: "1週間前の むぎから 届きました。",
              voice: "1回目の 夏の、ある日。",
              bridge: "あれから、7日。",
              deliveredAt: now,
            },
          }),
        );
      } else {
        window.localStorage.removeItem("neteruneko_omoide_memories");
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

async function mockDeskExchangeEmpty(page: Page) {
  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });
}
