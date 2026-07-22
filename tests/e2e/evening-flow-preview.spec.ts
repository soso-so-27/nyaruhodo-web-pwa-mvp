import path from "node:path";

import { expect, test } from "@playwright/test";

test.describe("20時前の実機確認フロー", () => {
  test("本番通信を使わず、送信から4匹選択・保存まで進める", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const protectedRequests: string[] = [];

    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("/api/sleeping-delivery/") ||
        url.includes("/api/reports") ||
        url.includes("/rest/v1/product_analytics_events") ||
        url.includes("/rest/v1/app_events")
      ) {
        protectedRequests.push(url);
      }
    });

    await page.goto("/prototypes/evening-flow");
    await expect(page.getByTestId("evening-preview-ready")).toBeVisible();
    await page.getByLabel("自分の写真で試す").setInputFiles(
      path.resolve(process.cwd(), "public/sample-cats/mugi-hero.png"),
    );
    await expect(page.getByText("写真を変える", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("evening-preview-ready").locator("img"),
    ).toHaveAttribute("src", /^data:image\/png;base64,/);
    await page.getByTestId("evening-preview-send").click();

    await expect(page.getByTestId("evening-preview-waiting")).toBeVisible();
    await page.getByTestId("evening-preview-advance").click();

    await expect(page.getByTestId("evening-preview-arrived")).toBeVisible();
    await page.getByTestId("evening-preview-open").click();

    const dialog = page.getByTestId("evening-four-choice");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("evening-four-choice-option")).toHaveCount(4);
    await dialog.getByTestId("evening-four-choice-option").nth(2).click();
    await dialog.getByTestId("evening-four-choice-save").click();
    await expect(dialog.getByTestId("evening-four-choice-saved")).toBeVisible();
    await dialog.getByTestId("evening-four-choice-finish").click();

    await expect(page.getByTestId("evening-preview-done")).toContainText(
      "1匹を「とどいた」に保存しました",
    );
    expect(protectedRequests).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });

  test("閉じて再開すると仮選択を保ち、保存しないでも終了できる", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/prototypes/evening-flow");
    await page.getByTestId("evening-preview-send").click();
    await page.getByTestId("evening-preview-advance").click();
    await page.getByTestId("evening-preview-open").click();

    let dialog = page.getByTestId("evening-four-choice");
    const selected = dialog.getByTestId("evening-four-choice-option").nth(1);
    await selected.click();
    await dialog.getByTestId("evening-four-choice-close").click();

    await expect(page.getByTestId("evening-preview-arrived")).toContainText(
      "さっき選んだ1匹から再開します",
    );
    await page.getByTestId("evening-preview-open").click();
    dialog = page.getByTestId("evening-four-choice");
    await expect(dialog.getByTestId("evening-four-choice-option").nth(1)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await dialog.getByTestId("evening-four-choice-skip").click();

    await expect(page.getByTestId("evening-preview-done")).toContainText(
      "今回は保存しませんでした",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  });
});
