import { expect, test } from "@playwright/test";

test.describe("cat illustration theme prototype", () => {
  test("applies a query variant and keeps it for the next page", async ({
    page,
  }) => {
    await page.goto("/onboarding?illust=theme-b");

    const introCat = page.locator('img[src$="/theme-b/home-empty-cat.webp"]');
    await expect(introCat).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("neteruneko_cat_illustration_variant"),
        ),
      )
      .toBe("theme-b");

    await page.goto("/onboarding");
    await expect(page.locator('img[src$="/theme-b/home-empty-cat.webp"]')).toBeVisible();
  });

  test("falls back to the current illustration when a candidate is missing", async ({
    page,
  }) => {
    await page.route("**/illustrations/candidates/theme-c/home-empty-cat.webp", (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.goto("/onboarding?illust=theme-c");

    await expect(
      page.locator('img[src$="/illustrations/sleeping-cat-empty.webp"]'),
    ).toBeVisible();
  });

  test("switches the theme from the board prototype settings sheet", async ({
    page,
  }) => {
    await page.goto("/prototypes/board-v2?illust=current");
    await page.getByTestId("board-v2-settings-button").click();

    const themeB = page.getByTestId("cat-illustration-variant-theme-b");
    await expect(themeB).toBeVisible();
    await themeB.click();

    await expect(themeB).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/illust=theme-b/);
    await expect(
      page
        .getByRole("link", { name: "うちのこ" })
        .locator('img[src$="/theme-b/nav-uchinoko.webp"]'),
    ).toBeVisible();

    await page.screenshot({
      path: "artifacts/cat-illustration-themes/board-v2-theme-switcher.png",
      fullPage: true,
    });
  });

  test("compares theme E navigation colors on the state1 home preview", async ({
    page,
  }) => {
    await page.goto("/prototypes/board-v2?illust=e-nav-rainbow");

    const preview = page.getByTestId("theme-e-home-preview");
    await expect(preview).toBeVisible();
    await expect(
      preview.getByRole("img", { name: "眠っている虹色のねこ" }),
    ).toHaveAttribute(
      "src",
      "/illustrations/candidates/theme-e-nav/home-empty-cat.png",
    );
    await expect(
      page.getByTestId("theme-e-preview-nav-きょう").locator("img"),
    ).toHaveAttribute("width", "44");
    await expect(
      page.getByTestId("theme-e-preview-nav-きょう").locator("img"),
    ).toHaveAttribute(
      "src",
      "/illustrations/candidates/theme-e-nav/nav-rainbow.webp",
    );

    await page.getByRole("button", { name: "夜" }).click();
    await expect(preview).toHaveAttribute("data-ambient", "night");

    await page.getByTestId("board-v2-settings-button").click();
    const seal = page.getByTestId("cat-illustration-variant-e-nav-seal");
    await seal.click();
    await expect(page).toHaveURL(/illust=e-nav-seal/);
    await expect(
      page.getByTestId("theme-e-preview-nav-うちのこ").locator("img"),
    ).toHaveAttribute(
      "src",
      "/illustrations/candidates/theme-e-nav/nav-seal.webp",
    );

    await page.getByTestId("cat-illustration-variant-theme-b").click();
    await expect(page).toHaveURL(/illust=theme-b/);
    await expect(page.getByTestId("theme-e-home-preview")).toHaveCount(0);
  });

  test("captures the theme E navigation candidates in day and night ambient", async ({
    page,
  }) => {
    for (const variant of [
      "e-nav-rainbow",
      "e-nav-sumi",
      "e-nav-seal",
    ]) {
      await page.goto(`/prototypes/board-v2?illust=${variant}`);
      await expect(page.getByTestId("theme-e-home-preview")).toBeVisible();
      await page.screenshot({
        path: `artifacts/cat-illustration-themes/${variant}-day.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "夜" }).click();
      await expect(page.getByTestId("theme-e-home-preview")).toHaveAttribute(
        "data-ambient",
        "night",
      );
      await page.screenshot({
        path: `artifacts/cat-illustration-themes/${variant}-night.png`,
        fullPage: true,
      });
    }
  });
});
