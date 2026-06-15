import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const shotsDir = path.resolve(process.cwd(), "artifacts", "shots", "taimen");

test.beforeAll(() => {
  fs.rmSync(shotsDir, { recursive: true, force: true });
  fs.mkdirSync(shotsDir, { recursive: true });
});

test.describe("taimen prototype shots", () => {
  for (const pattern of ["mixed", "portrait", "landscape"] as const) {
    for (const mode of ["a", "b", "c"] as const) {
      test(`${mode}_${pattern}`, async ({ page }) => {
        await page.goto("/prototypes/taimen");
        await page.waitForLoadState("networkidle");
        await page.getByRole("button", { name: `案${mode.toUpperCase()}` }).click();
        await page.getByRole("button", { name: patternLabel(pattern) }).click();
        await expect(page.getByTestId(`taimen-mode-${mode}`)).toBeVisible();
        await page.screenshot({
          path: path.join(shotsDir, `taimen_${mode}_${pattern}.png`),
          fullPage: true,
        });
      });
    }
  }

  test("c_mixed_letter_page", async ({ page }) => {
    await page.goto("/prototypes/taimen");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "案C" }).click();
    await page.getByRole("button", { name: "縦横まぜ" }).click();
    await page.getByRole("button", { name: "手紙" }).click();
    await expect(page.getByTestId("taimen-mode-c")).toBeVisible();
    await page.screenshot({
      path: path.join(shotsDir, "taimen_c_mixed_letter_page.png"),
      fullPage: true,
    });
  });
});

function patternLabel(pattern: "mixed" | "portrait" | "landscape") {
  if (pattern === "mixed") return "縦横まぜ";
  if (pattern === "portrait") return "縦長どうし";
  return "横長どうし";
}
