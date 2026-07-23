import { devices, expect, test, type Page } from "@playwright/test";

const ownDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

const deliveredDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";
const currentJstDateKey = getCurrentJstDateKey();
const beforeEightToday = getCurrentJstTime(19, 30);
const afterEightToday = getCurrentJstTime(20, 5);

test.describe("home desk model", () => {
  test("serves a plain home surface before client state hydrates", async ({
    request,
  }) => {
    for (const route of ["/", "/home"]) {
      const response = await request.get(route);
      expect(response.ok()).toBe(true);
      const html = await response.text();

      expect(html).toContain('data-testid="home-startup-surface"');
      expect(html).not.toContain('data-testid="home-startup-skeleton"');
      expect(html).not.toContain("data-startup-min-ms");
      expect(html).not.toContain("data-startup-fade-ms");
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

  test("does not request notification permission without a delivery notification service", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "standalone", {
        configurable: true,
        value: true,
      });
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: {
          permission: "default",
          requestPermission: () => {
            const testWindow = window as typeof window & {
              __notificationPermissionRequests?: number;
            };
            testWindow.__notificationPermissionRequests =
              (testWindow.__notificationPermissionRequests ?? 0) + 1;
            return Promise.resolve("granted");
          },
        },
      });
    });
    await seedDeskState(page, "1");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & {
              __notificationPermissionRequests?: number;
            }).__notificationPermissionRequests ?? 0,
        ),
      )
      .toBe(0);
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
    expect(html).toContain('data-testid="home-startup-surface"');
    expect(html).not.toContain("Googleでつづける");
    expect(html).not.toContain("ログイン");

    await page.goto("/home?handoff=restored");
    await expect(page.getByTestId("home-desk-model")).toBeVisible();
    await expect(page.getByTestId("home-startup-surface")).toHaveCount(0);
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
    await expect(page.getByText("「うちのこ」に保存しました")).toBeVisible();
    await expect(
      page.getByText("よる8時ごろ、4枚のねこだよりがとどきます"),
    ).toBeVisible();
    await expect(page.getByTestId("home-retake-action")).toBeVisible();
    await expect(page.getByTestId("home-retake-action")).toHaveText("とりなおす");
    await expect(
      page.getByText("きょうの一枚を、よる8時のねこだよりに。"),
    ).toHaveCount(0);
    await expect(page.getByText("この子の写真を追加")).toHaveCount(0);
    await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    await expect(page.getByTestId("today-pair-nav-icon")).toBeVisible();
    await expect(page.getByTestId("today-pair-nav-slot")).toHaveCount(2);
    for (const slot of await page.getByTestId("today-pair-nav-slot").all()) {
      const box = await slot.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(8);
      expect(box?.height).toBeGreaterThanOrEqual(11);
    }
    await page
      .getByRole("button", { name: "むぎのきょうのねがおを大きく見る" })
      .click();
    await expect(
      page.getByText(
        "「わたしのねがお」に自分だけで保存しています",
      ),
    ).toBeVisible();
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

  test("shows every bottom navigation label and marks the active destination", async ({ page }) => {
    await seedDeskState(page, "1");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const nav = page.getByRole("navigation", { name: "下部ナビゲーション" });
    await expect(nav.getByRole("link", { name: "きょう" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByText("きょう", { exact: true })).toBeVisible();
    await expect(nav.getByText("ねこだより", { exact: true })).toBeVisible();
    await expect(nav.getByText("うちのこ", { exact: true })).toBeVisible();
    const navLinks = nav.getByRole("link");
    await expect(navLinks).toHaveCount(3);
    await expect(navLinks.nth(0)).toHaveAccessibleName("きょう");
    await expect(navLinks.nth(1)).toHaveAccessibleName("うちのこ");
    await expect(navLinks.nth(2)).toHaveAccessibleName("ねこだより");

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
    await expect(collectionNav.getByText("きょう", { exact: true })).toBeVisible();
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
    await expect(
      page.getByText("よる8時ごろ、4枚のねこだよりがとどきます"),
    ).toBeVisible();

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
    await expect(
      page.getByText("よる8時ごろ、4枚のねこだよりがとどきます"),
    ).toBeVisible();

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
    await expect(page.getByTestId("desk-open-letter")).toHaveAttribute(
      "data-arrival-context",
      "live",
    );
  });

  test("shows where an unopened letter went after the 5am system open", async ({
    page,
  }) => {
    await seedDeskState(page, "1", {
      now: getCurrentJstTime(6, 15),
      withSystemOpenedYesterday: true,
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("きのう選んだ写真は")).toBeVisible();
    await expect(page.getByText("「とどいた」に保存しました")).toBeVisible();
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);
    await expect(page.getByTestId("evening-opening-pair")).toHaveCount(0);
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
    await expect(
      page.getByText("よる8時ごろ、4枚のねこだよりがとどきます"),
    ).toBeVisible();
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
    await expect(page.getByText("ねがおを とる", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "写真は「うちのこ」に残ります。「ねこだよりにする」と、よる8時ごろ4枚とどきます。",
      ),
    ).toBeVisible();
    await expect(
      page.locator('img[src$="/theme-e5-direction/muted.webp"]'),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: "きょう" })
        .locator('img[src$="/icons/bottom-nav-today.webp"]'),
    ).toBeVisible();
    await expect(page.getByText("ねてない子は、アルバムへ")).toHaveCount(0);
    await expect(page.getByText("この子の写真を追加")).toHaveCount(0);
    await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    await expect(page.getByTestId("desk-empty-frame")).toHaveCSS(
      "border-style",
      "none",
    );
    await expect(page.getByTestId("desk-empty-frame")).toHaveCSS("cursor", "auto");
    await page.getByTestId("home-empty-action").click();
    await expect(page.getByTestId("home-sleeping-source-camera")).toBeVisible();
    await expect(page.getByTestId("home-sleeping-source-library")).toBeVisible();
  });

  test("clears the legacy second-photo action after 8pm", async ({
    page,
  }) => {
    await seedDeskState(page, "1", { now: getCurrentJstTime(21, 0) });
    await page.goto("/home?handoff=restored&from=onboarding_second_photo");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1b",
    );
    await expect(page.getByTestId("onboarding-second-photo-invitation")).toHaveCount(0);
    await expect(page).not.toHaveURL(/from=onboarding_second_photo/);
    await expect(
      page.getByText("あしたの一通も、つくりませんか"),
    ).toHaveCount(0);
    await expect(
      page.getByText("あしたのねこだよりに入れるねがおを一枚。"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "あしたの一枚を入れる" }),
    ).toHaveCount(0);
  });

  test("does not label an unscheduled onboarding photo as tonight's sent photo", async ({
    page,
  }) => {
    await seedDeskState(page, "1", { withUnscheduledOwnPhoto: true });
    await page.goto("/home?handoff=restored&from=onboarding_second_photo");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );
    await expect(page.getByTestId("desk-home-frame")).toHaveAttribute(
      "data-photo-id",
      "own-desk",
    );
    await expect(page.getByTestId("onboarding-second-photo-invitation")).toHaveCount(0);
    await expect(page).not.toHaveURL(/from=onboarding_second_photo/);
    await expect(page.getByTestId("home-letter-tray")).toHaveCount(0);
    await expect(page.getByText("おくった", { exact: true })).toHaveCount(0);
    await expect(page.getByText("よる8時に とどく", { exact: true })).toHaveCount(0);
  });

  test("clears the second-photo intent after a tonight photo is already scheduled", async ({
    page,
  }) => {
    await seedDeskState(page, "2");
    await page.goto("/home?handoff=restored&from=onboarding_second_photo");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("onboarding-second-photo-invitation")).toHaveCount(0);
    await expect(page).not.toHaveURL(/from=onboarding_second_photo/);
    await expect(
      page.getByText("よる8時ごろ、4枚のねこだよりがとどきます", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("opens a full iOS store and compacts duplicate photo sources", async ({
    page,
  }) => {
    await seedDeskState(page, "2");
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function patchedSetItem(key, value) {
        if (key === "active_cat_id" && this.getItem(key) !== null) {
          throw new DOMException("The quota has been exceeded", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };

      const photos = JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
          "[]",
      );
      if (photos[0]?.src) {
        photos[0].thumbnailSrc = photos[0].src;
        photos[0].displaySrc = photos[0].src;
        photos[0].originalSrc = photos[0].src;
        originalSetItem.call(
          window.localStorage,
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify(photos),
        );
      }
    });

    await page.goto("/home");
    await expect(page.getByTestId("home-desk-model")).toBeVisible();

    const storedPhoto = await page.evaluate(() => {
      const photos = JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
          "[]",
      );
      return photos[0] ?? null;
    });
    expect(storedPhoto?.src).toBeTruthy();
    expect(storedPhoto?.thumbnailSrc).toBeUndefined();
    expect(storedPhoto?.displaySrc).toBeUndefined();
    expect(storedPhoto?.originalSrc).toBeUndefined();
  });

  test("matches Android camera photo ratios and keeps controls inside the viewport", async ({
    browser,
  }) => {
    const ratios = [
      { name: "portrait", width: 900, height: 1600 },
      { name: "landscape", width: 1600, height: 900 },
    ] as const;

    for (const ratio of ratios) {
      await test.step(ratio.name, async () => {
        const androidContext = await browser.newContext({
          ...devices["Pixel 7"],
          baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
        });
        const androidPage = await androidContext.newPage();
        try {
          await androidPage.goto("about:blank");
          const photoDataUrl = await buildRasterPhotoDataUrl(
            androidPage,
            ratio.width,
            ratio.height,
          );
          await seedDeskState(androidPage, "2", { ownPhotoDataUrl: photoDataUrl });
          await androidPage.goto("/home");
          await androidPage.waitForLoadState("networkidle");

          const frame = androidPage.getByTestId("desk-home-frame");
          await expect(frame).toBeVisible();
          await expect
            .poll(() =>
              frame.locator("img").evaluate((image) => {
                const element = image as HTMLImageElement;
                return element.naturalWidth / element.naturalHeight;
              }),
            )
            .toBeCloseTo(ratio.width / ratio.height, 3);

          const layout = await androidPage.evaluate(() => {
            const frameElement = document.querySelector<HTMLElement>(
              '[data-testid="desk-home-frame"]',
            );
            const navElement = document.querySelector<HTMLElement>(
              'nav[aria-label="下部ナビゲーション"]',
            );
            const settingsElement = document.querySelector<HTMLElement>(
              '[data-testid="home-settings-shortcut"]',
            );
            const frameRect = frameElement?.getBoundingClientRect();
            const navRect = navElement?.getBoundingClientRect();
            const settingsRect = settingsElement?.getBoundingClientRect();
            return {
              frameRatio:
                frameRect && frameRect.height > 0
                  ? frameRect.width / frameRect.height
                  : 0,
              frameBottom: frameRect?.bottom ?? Number.POSITIVE_INFINITY,
              navTop: navRect?.top ?? 0,
              navBottomGap: navRect ? window.innerHeight - navRect.bottom : -1,
              settingsTop: settingsRect?.top ?? -1,
            };
          });

          expect(layout.frameRatio).toBeCloseTo(ratio.width / ratio.height, 2);
          expect(layout.frameBottom).toBeLessThan(layout.navTop);
          expect(layout.navBottomGap).toBeGreaterThanOrEqual(12);
          expect(layout.settingsTop).toBeGreaterThanOrEqual(12);
          await androidPage.screenshot({
            path: `artifacts/android-home-layout/state2-${ratio.name}.png`,
            fullPage: true,
          });
        } finally {
          await androidContext.close();
        }
      });
    }
  });

  test("adapts the b3 ink trace across the four ambient periods", async ({
    context,
  }) => {
    test.setTimeout(60_000);
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
    test.setTimeout(60_000);
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

  test("captures the three e5 directions across all ambient periods", async ({
    context,
  }) => {
    test.setTimeout(90_000);
    const variants = ["e5-original", "e5-muted", "e5-mono"] as const;
    const periods = [
      { name: "morning", now: getCurrentJstTime(7, 0) },
      { name: "noon", now: getCurrentJstTime(12, 0) },
      { name: "evening", now: getCurrentJstTime(17, 0) },
      { name: "night", now: getCurrentJstTime(22, 0) },
    ];

    for (const variant of variants) {
      for (const period of periods) {
        const periodPage = await context.newPage();
        await seedDeskState(periodPage, "1", { now: period.now });
        await periodPage.goto(`/home?illust=${variant}`);
        await periodPage.waitForLoadState("networkidle");

        const candidate = periodPage.locator(
          `img[src*="/illustrations/candidates/theme-e5-direction/"]`,
        );
        await expect(candidate).toBeVisible();
        await periodPage.screenshot({
          path: `artifacts/cat-illustration-e5-direction/${variant}-${period.name}.png`,
          fullPage: true,
        });
        await periodPage.close();
      }
    }
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
    await expect(page.getByTestId("home-letter-tray")).toContainText(
      "保存すると、次のよる8時ごろにねこだよりがとどきます",
    );
    await expect(page.getByText("きょうは とどかない")).toHaveCount(0);
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

    expect(settingsBox?.width).toBe(44);
    expect(settingsBox?.height).toBe(44);
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
    await expect(letter).toHaveAttribute("data-arrival-context", "waiting");
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
    await expect(openingPair.getByTestId("evening-opening-masthead")).toHaveText(
      "ねこだより",
    );
    await expect(openingPair.locator("img")).toHaveCount(1);
    await expect(openingPair).toContainText(
      "この写真は、「とどいた」に保存しました",
    );
    await expect(openingPair).toContainText(
      "どこかのおうちからとどいたねこだよりです。",
    );
    await expect(openingPair.getByRole("button", { name: "閉じる" })).toHaveCount(
      0,
    );
    await expect(openingPair.locator("button")).toHaveCount(1);
    await expect(
      openingPair.getByRole("button", { name: "ホームへ" }),
    ).toBeVisible();
    await page.screenshot({
      path: "artifacts/home-evening-opening.png",
      fullPage: true,
    });
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

  test("names the wait when delivered photo decoding is slow", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLImageElement.prototype.decode = function delayedDecode() {
        return new Promise<void>((resolve) => {
          window.setTimeout(resolve, 3000);
        });
      };
    });
    await seedDeskState(page, "3");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    const letter = page.getByTestId("desk-open-letter");
    await letter.click();
    await expect(letter).toHaveAttribute("data-opening-wait", "true", {
      timeout: 1000,
    });
    await expect(letter).toHaveAttribute(
      "aria-label",
      "ねこだよりをひらいています",
    );
    await expect(page.getByTestId("evening-opening-pair")).toBeVisible({
      timeout: 2500,
    });
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
    await openingPair.getByRole("button", { name: "ホームへ" }).click();

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
    await openingPair.getByRole("button", { name: "ホームへ" }).click();

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
    await expect(viewer).toHaveAttribute("data-photo-viewer-motion", "continuous");
    await expect(viewer.getByRole("button", { name: "とじる" })).toBeVisible();
    await expect(viewer.getByTestId("desk-photo-viewer-stow")).toHaveCount(0);
    await expect(viewer.getByRole("button", { name: "とじる" })).toBeFocused();

    await page.goBack();
    await expect(viewer).toHaveCount(0);
    await expect(frame).toBeFocused();
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
    await expect(closeButton).toHaveText("ホームへ");
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

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("cats-nav-unopened-omoide-dot")).toHaveCount(0);

    await page.goto("/cats#omoide");
    await page.waitForLoadState("networkidle");
    const bunbako = page.getByTestId("omoide-bunbako");
    await expect(bunbako).toBeVisible();
    await expect(bunbako.getByText("思い出箱")).toBeVisible();
    await expect(bunbako.getByText("はじめての、ねがお。")).toBeVisible();
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

  test("keeps a delivered photo visible after its offline copy is written", async ({
    page,
  }) => {
    const remotePhotoUrl = "https://photos.test/evening-delivered.png";

    await page.route(remotePhotoUrl, async (route) => {
      await route.fulfill({
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" },
        body: Buffer.from(deliveredDataUrl.split(",")[1], "base64"),
      });
    });
    await seedDeskState(page, "3", { deliveredPhotoSrc: remotePhotoUrl });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("desk-open-letter").click();
    const deliveredPhoto = page
      .getByTestId("evening-opening-photo-frame")
      .locator('img[alt="ねこだより"]');

    await expect
      .poll(() =>
        page.evaluate(() => {
          const cached = JSON.parse(
            window.localStorage.getItem(
              "neteruneko_exchange_photo_offline_cache",
            ) ?? "[]",
          );
          return Array.isArray(cached) ? cached.length : 0;
        }),
      )
      .toBe(1);
    await expect(deliveredPhoto).toHaveCSS("opacity", "1");
  });

  test("prioritizes a cat without memories and keeps one household arrival per day", async ({
    page,
  }) => {
    await seedDeskState(page, "1b", {
      withAllCatOmoideCandidates: true,
      withStoredOmoide: true,
      storedOmoideDeliveredDaysAgo: 8,
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem("neteruneko_omoide_memories");
          if (!raw) return [];
          return Object.values(
            JSON.parse(raw) as Record<string, { catId: string; reason: string }>,
          )
            .map((memory) => `${memory.catId}:${memory.reason}`)
            .sort();
        }),
      )
      .toEqual(["cat-desk-second:first_seed", "cat-desk:same_day"]);
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
    storedOmoideDeliveredDaysAgo?: number;
    usedOmoideSourcePhotoIds?: string[];
    omoideDisabled?: boolean;
    withAllCatOmoideCandidates?: boolean;
    withoutOwnPhoto?: boolean;
    withUnscheduledOwnPhoto?: boolean;
    openedBySystem?: boolean;
    withSystemOpenedYesterday?: boolean;
    ownPhotoDataUrl?: string;
    deliveredPhotoSrc?: string;
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
        src: options.deliveredPhotoSrc ?? deliveredDataUrl,
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
      const profiles = [
        {
          id: catId,
          name: "むぎ",
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        },
      ];
      if (options.withAllCatOmoideCandidates) {
        profiles.push({
          id: "cat-desk-second",
          name: "あめ",
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        });
      }
      window.localStorage.setItem("cat_profiles", JSON.stringify(profiles));

      const ownPhotos = options.withoutOwnPhoto
        ? []
        : options.withUnscheduledOwnPhoto || (state !== "1" && state !== "1b")
          ? [ownPhoto]
          : [];
      const omoidePhoto = {
        ...ownPhoto,
        id: "own-omoide-week",
        createdAt: beforeEightValue - 7 * 24 * 60 * 60 * 1000,
      };
      const secondCatOmoidePhoto = {
        ...omoidePhoto,
        id: "own-omoide-week-second",
        ownerCatId: "cat-desk-second",
        catId: "cat-desk-second",
        createdAt: beforeEightValue - 30 * 24 * 60 * 60 * 1000,
      };
      const omoideCandidates = options.withAllCatOmoideCandidates
        ? [omoidePhoto, secondCatOmoidePhoto]
        : options.withOmoideCandidate
          ? [omoidePhoto]
          : [];
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([...omoideCandidates, ...ownPhotos]),
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

      if (options.withSystemOpenedYesterday) {
        const [year, month, day] = dateKeyValue.split("-").map(Number);
        const todayStart = Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000;
        const yesterdayKey = new Date(Date.UTC(year, month - 1, day) - 86400000)
          .toISOString()
          .slice(0, 10);
        store[yesterdayKey] = {
          dateKey: yesterdayKey,
          targetOwnPhotoId: "own-yesterday-system",
          targetCatId: catId,
          targetCapturedAt: todayStart - 8 * 60 * 60 * 1000,
          deliveredPhoto: {
            ...deliveredPhoto,
            id: "delivered-yesterday-system",
            sourcePhotoId: "source-yesterday-system",
            deliveredAt: todayStart - 4 * 60 * 60 * 1000,
          },
          deliveredAt: todayStart - 4 * 60 * 60 * 1000,
          openedAt: todayStart + 5 * 60 * 60 * 1000,
          openedBy: "system",
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
                deliveryDateKey: new Date(
                  now -
                    (options.storedOmoideDeliveredDaysAgo ?? 0) *
                      24 *
                      60 *
                      60 *
                      1000,
                )
                  .toISOString()
                  .slice(0, 10),
              photo: memoryPhoto,
              lookback: "week",
              reason: "same_day",
              title: "1週間前の、きょう",
              subtitle: "1週間前の むぎから ねがおが とどきました。",
              voice: "1回目の 夏の、ある日。",
              bridge: "あれから、7日。",
              deliveredAt:
                now -
                (options.storedOmoideDeliveredDaysAgo ?? 0) *
                  24 *
                  60 *
                  60 *
                  1000,
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
      ownDataUrl: options.ownPhotoDataUrl ?? ownDataUrl,
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

async function buildRasterPhotoDataUrl(
  page: Page,
  width: number,
  height: number,
) {
  return page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas_context_unavailable");
      context.fillStyle = "#c98f7b";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#f5e8d8";
      context.beginPath();
      context.arc(width / 2, height * 0.45, Math.min(width, height) * 0.2, 0, Math.PI * 2);
      context.fill();
      return canvas.toDataURL("image/png");
    },
    { width, height },
  );
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
