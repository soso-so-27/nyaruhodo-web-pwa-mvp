import { expect, test } from "@playwright/test";

test("AppSheet locks scroll, traps focus, and closes with Escape", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date("2026-06-10T00:00:00.000Z").toISOString();
    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([
        {
          id: "cat-mugi",
          name: "むぎ",
          createdAt: now,
          updatedAt: now,
          appearance: { coat: "orange_tabby" },
        },
        {
          id: "cat-sora",
          name: "そら",
          createdAt: now,
          updatedAt: now,
          appearance: { coat: "calico" },
        },
      ]),
    );
    window.localStorage.setItem("active_cat_id", "cat-mugi");
  });

  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  const trigger = page.getByLabel("ほかのねこを見る");
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "ねこを選ぶ" });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog?.contains(document.activeElement);
      }),
    )
    .toBe(true);

  await page.keyboard.press("Shift+Tab");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog?.contains(document.activeElement);
      }),
    )
    .toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  await expect(trigger).toBeFocused();
});
