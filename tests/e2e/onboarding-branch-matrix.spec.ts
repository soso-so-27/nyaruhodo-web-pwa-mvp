import { expect, test, type Page } from "@playwright/test";

const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const LINE_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.0.0";
const INSTAGRAM_IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 385.0.0.25.75";

test.describe("onboarding branch matrix", () => {
  for (const scenario of [
    {
      name: "regular Safari before 20時",
      ua: IOS_SAFARI_UA,
      source: "instagram_bio",
      standalone: false,
      expectGoogle: true,
    },
    {
      name: "LINE in-app browser",
      ua: LINE_ANDROID_UA,
      source: "instagram_dm",
      standalone: false,
      expectGoogle: false,
    },
    {
      name: "Instagram in-app browser",
      ua: INSTAGRAM_IOS_UA,
      source: "instagram_story",
      standalone: false,
      expectGoogle: false,
    },
    {
      name: "installed standalone app",
      ua: IOS_SAFARI_UA,
      source: "direct",
      standalone: true,
      expectGoogle: true,
    },
  ]) {
    test(`routes account continuation controls for ${scenario.name}`, async ({
      page,
    }) => {
      await installBrowserScenario(page, scenario);

      await page.goto(`/account/create?from=onboarding&source=${scenario.source}`);
      await expect(page.getByTestId("account-create-handoff")).toBeVisible();

      if (scenario.expectGoogle) {
        await expect(page.getByTestId("account-create-google")).toBeVisible();
      } else {
        await expect(page.getByTestId("account-create-google")).toHaveCount(0);
      }
    });
  }

  test("lets locally restored users continue when a handoff was already consumed", async ({
    page,
  }) => {
    let redeemCalls = 0;
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem(
        "neteruneko_onboarding_progress",
        JSON.stringify({
          version: 1,
          anonymousId: "matrix-restored",
          dateKey: "2026-07-10",
          stage: "album_created",
          source: "handoff",
          submissionId: "onboarding:matrix-restored:2026-07-10",
          updatedAt: Date.now(),
        }),
      );
    });
    await page.route("**/api/onboarding/handoff/redeem", async (route) => {
      redeemCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        status: 409,
        body: JSON.stringify({ ok: false, error: "handoff_already_used" }),
      });
    });

    await page.goto("/onboarding/continue?handoff=used-token");
    await page.locator("main button").first().click();

    await expect.poll(() => redeemCalls).toBe(1);
    if (!/\/home\?handoff=restored/.test(page.url())) {
      await page.locator("main button").first().click();
    }
    await page.waitForURL(/\/home\?handoff=restored/, { timeout: 5_000 });
  });
});

async function installBrowserScenario(
  page: Page,
  scenario: { ua: string; standalone: boolean },
) {
  await page.addInitScript(({ ua, standalone }) => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      get: () => ua,
    });
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      get: () => standalone,
    });
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query === "(display-mode: standalone)") {
        return {
          matches: standalone,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => true,
        } as MediaQueryList;
      }

      return originalMatchMedia(query);
    };
    window.localStorage.removeItem("onboarding_completed");
    window.localStorage.removeItem("neteruneko_onboarding_progress");
  }, scenario);
}
