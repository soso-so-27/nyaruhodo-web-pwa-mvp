import { devices, expect, test } from "@playwright/test";

import { isAppShellResourceError } from "../../src/lib/pwa/recoverAppShell";
import { formatAppErrorDiagnostic } from "../../src/app/error";

test.describe("app shell recovery", () => {
  test("recognizes stale deployment chunk failures", () => {
    expect(isAppShellResourceError(new Error("Loading chunk 312 failed"))).toBe(
      true,
    );
    expect(
      isAppShellResourceError(
        new TypeError("Failed to fetch dynamically imported module"),
      ),
    ).toBe(true);
    expect(isAppShellResourceError(new Error("invalid local record"))).toBe(
      false,
    );
  });

  test("formats a bounded diagnostic without hiding the digest", () => {
    const error = Object.assign(new Error("home hydration failed"), {
      digest: "abc123",
    });

    expect(formatAppErrorDiagnostic(error)).toBe(
      "Error: home hydration failed / abc123",
    );
  });

  test("explains an unknown route and provides a clear way home", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      ...devices["iPhone 14"],
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    });
    const page = await context.newPage();

    await page.goto("/this-page-does-not-exist");

    await expect(
      page.getByText("このページは見つかりませんでした"),
    ).toBeVisible();
    await expect(
      page.getByText("保存済みの写真や記録には影響ありません。", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "ホームへ戻る" })).toHaveAttribute(
      "href",
      "/home",
    );
    await context.close();
  });
});
