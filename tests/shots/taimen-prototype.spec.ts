import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const shotsDir = path.resolve(process.cwd(), "artifacts", "shots", "taimen");

test.beforeAll(() => {
  fs.rmSync(shotsDir, { recursive: true, force: true });
  fs.mkdirSync(shotsDir, { recursive: true });
});

test.describe("taimen B refinement prototype shots", () => {
  for (const pattern of ["mixed", "portrait", "landscape"] as const) {
    for (const mode of ["b1", "b2"] as const) {
      test(`${mode}_${pattern}`, async ({ page }) => {
        await page.goto("/prototypes/taimen");
        await page.waitForLoadState("networkidle");
        await page.getByTestId(`taimen-mode-button-${mode}`).click();
        await page.getByTestId(`taimen-pattern-button-${pattern}`).click();
        await expect(page.getByTestId(`taimen-mode-${mode}`)).toBeVisible();
        await page.screenshot({
          path: path.join(shotsDir, `taimen_${mode}_${pattern}.png`),
          fullPage: true,
        });
      });
    }
  }
});
