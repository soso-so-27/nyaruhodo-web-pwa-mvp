import { expect, test } from "@playwright/test";

const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAApklEQVR4nO3RwQkAMAzAsPz/0y7Q7kKCnQwMZKfTnQfQ2WfP7gGwFQkBIiFQJASKhEARkRQIEgJFQqBIQpEQKBIChUKhSEKRECgSAkVCoEhCkRAoEgJFQqBIQpEQKBIChUKhSEKRECgSAkVCoEhCkRAoEgJFQqBIQpEQKBIChUKhSEKRECgSAkVCoEhCkRAoEgJFQqBIQpEQKBIChUKhSEKR8ASttwJmX7Vg8AAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("onboarding delivery flow", () => {
  test("reaches the album after adding a real test candidate", async ({ page }) => {
    let exchangeCalls = 0;
    let stockCalls = 0;
    const stockResponses: Array<{
      ok: boolean;
      status: number;
      hasPhoto: boolean;
      error?: string | null;
      srcKind?: string;
    }> = [];
    const exchangeResponses: Array<{
      source?: string;
      hasPhoto: boolean;
      error?: string | null;
      diagnostics?: Record<string, unknown>;
    }> = [];

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

      await route.continue();
    });

    page.on("response", async (response) => {
      const url = response.url();

      if (url.includes("/api/sleeping-delivery/stock")) {
        stockCalls += 1;
        try {
          const result = await response.json();
          stockResponses.push({
            ok: response.ok(),
            status: response.status(),
            hasPhoto: Boolean(result.photo),
            error: result.error ?? null,
            srcKind: readSrcKind(result.photo?.src),
          });
        } catch {
          stockResponses.push({
            ok: response.ok(),
            status: response.status(),
            hasPhoto: false,
            error: "unreadable_stock_response",
          });
        }
      }
      if (!url.includes("/api/sleeping-delivery/exchange")) {
        return;
      }

      try {
        const result = await response.json();
        exchangeResponses.push({
          source: result.source,
          hasPhoto: Boolean(result.photo),
          error: result.error ?? null,
          diagnostics: result.diagnostics,
        });
      } catch {
        exchangeResponses.push({
          hasPhoto: false,
          error: "unreadable_exchange_response",
        });
      }
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
    await expect.poll(() => stockResponses.length).toBe(1);
    expect(stockResponses[0]).toMatchObject({
      ok: true,
      status: 200,
      hasPhoto: true,
      error: null,
      srcKind: "data",
    });
    await expect.poll(() => exchangeCalls).toBe(2);
    await expect.poll(() => exchangeResponses.length).toBe(2);
    expect(exchangeResponses.at(-1)).toMatchObject({
      source: "remote",
      hasPhoto: true,
      error: null,
    });
    await expect(
      page.getByRole("button", { name: "アルバムで見る" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "アルバムで見る" }).click();
    await expect(page).toHaveURL(/\/collection/);

    const storage = await page.evaluate(() => {
      const readArray = (key: string) => {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");

          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      return {
        ownSleepingPhotos: readArray("nyaruhodo_exchange_own_sleeping_photos"),
        keptExchangePhotos: readArray("nyaruhodo_exchange_kept_photos"),
      };
    });

    expect(storage.ownSleepingPhotos.length).toBeGreaterThan(0);
    expect(storage.keptExchangePhotos.length).toBeGreaterThan(0);
    expect(storage.ownSleepingPhotos[0]?.src).toMatch(/^data:image\//);
    expect(storage.keptExchangePhotos[0]?.src).toBeTruthy();
  });
});

function readSrcKind(src: unknown) {
  if (typeof src !== "string") {
    return "empty";
  }
  if (src.startsWith("data:image/")) {
    return "data";
  }
  if (src.startsWith("storage:")) {
    return "storage";
  }
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return "http";
  }

  return "other";
}
