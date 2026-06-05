import { expect, test } from "@playwright/test";

const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAApklEQVR4nO3RwQkAMAzAsPz/0y7Q7kKCnQwMZKfTnQfQ2WfP7gGwFQkBIiFQJASKhEARkRQIEgJFQqBIQpEQKBIChUKhSEKRECgSAkVCoEhCkRAoEgJFQqBIQpEQKBIChUKhSEKRECgSAkVCoEhCkRAoEgJFQqBIQpEQKBIChUKhSEKRECgSAkVCoEhCkRAoEgJFQqBIQpEQKBIChUKhSEKR8ASttwJmX7Vg8AAAAABJRU5ErkJggg==",
  "base64",
);

const deliveredPhotoSrc =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAApklEQVR4nO3RwQkAMAzAsPz/0y7Q7kKCnQwMZKfTnQfQ2WfP7gGwFQkBIiFQJASKhEARkRQIEgJFQqBIQpEQKBIChUKhSEKRECgSAkVCoEhCkRAoEgJFQqBIQpEQKBIChUKhSEKRECgSAkVCoEhCkRAoEgJFQqBIQpEQKBIChUKhSEKRECgSAkVCoEhCkRAoEgJFQqBIQpEQKBIChUKhSEKR8ASttwJmX7Vg8AAAAABJRU5ErkJggg==";

test.describe("onboarding delivery flow", () => {
  test("retries delivery after adding a test candidate", async ({ page }) => {
    let exchangeCalls = 0;
    let stockCalls = 0;

    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;

      if (exchangeCalls === 1) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            photo: null,
            source: "none",
            diagnostics: {
              source: "none",
              availableCount: 0,
              candidateCount: 0,
              normalCandidateCount: 0,
              fallbackCandidateCount: 0,
              fallbackActive: false,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "delivered-test-photo",
            sourcePhotoId: "stock-test-photo",
            src: deliveredPhotoSrc,
            title: "ほかの猫のねがお",
            subtitle: "",
            triggerLabel: "ねがお",
            theme: "sleeping",
            deliveredAt: Date.now(),
          },
          source: "remote",
          diagnostics: {
            source: "remote",
            availableCount: 1,
            candidateCount: 1,
            normalCandidateCount: 1,
            fallbackCandidateCount: 0,
            fallbackActive: false,
          },
        }),
      });
    });

    await page.route("**/api/sleeping-delivery/stock", async (route) => {
      stockCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          photo: {
            id: "remote-stock-test-photo",
            sourceOwnPhotoId: "stock-test-photo",
            sourceCatId: "admin-stock",
            src: deliveredPhotoSrc,
            title: "ほかの猫のねがお",
            subtitle: "",
            tags: ["sleeping", "ねがお"],
          },
        }),
      });
    });

    await page.goto("/onboarding?test");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.locator("button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect.poll(() => exchangeCalls).toBe(1);
    await expect(page.locator("button").first()).toBeEnabled();

    await page.locator("button").first().click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "stock-sleeping.png",
      mimeType: "image/png",
      buffer: testPng,
    });

    await expect.poll(() => stockCalls).toBe(1);
    await expect.poll(() => exchangeCalls).toBe(2);
    await expect(
      page.getByRole("button", { name: "アルバムで見る" }),
    ).toBeVisible();
  });
});
