import { expect, test } from "@playwright/test";

test("asks for confirmation before saving a duplicate cat name", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const now = new Date("2026-06-10T00:00:00.000Z").toISOString();
    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([
        {
          id: "cat-mugi",
          name: "\u3080\u304e",
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );
    window.localStorage.setItem("active_cat_id", "cat-mugi");
  });

  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("cats-section-tab-basic").click();
  await page.getByRole("button", { name: "猫を追加・管理" }).click();
  await page.getByRole("button", { name: "ねこをふやす" }).click();
  await page.getByLabel(/\u3053\u306e\u5b50\u306e\u540d\u524d/).fill("\u30e0\u30ae");
  await page.getByRole("button", { name: /^\u4fdd\u5b58$/ }).click();

  await expect(
    page.getByText(/\u304a\u306a\u3058\u3053\u304b\u3082\u3057\u308c\u307e\u305b\u3093/),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("cat_profiles");
        return raw ? JSON.parse(raw).length : 0;
      }),
    )
    .toBe(1);

  await page
    .getByRole("button", {
      name: /\u5225\u306e\u306d\u3053\u3068\u3057\u3066\u4fdd\u5b58/,
    })
    .click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("cat_profiles");
        return raw ? JSON.parse(raw).length : 0;
      }),
    )
    .toBe(2);
});

test("shows birthday countdown on the cat page", async ({
  page,
}) => {
  await seedCatProfile(page, {
    now: "2026-06-10T00:00:00.000Z",
    birthDate: "2020-06-13",
  });

  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  const celebrations = page.getByRole("region", { name: "記念" });
  await expect(celebrations).toContainText("誕生日");
  await expect(celebrations).toContainText("あと3日");
  await expect(page.getByText("むぎの日まで あと3日")).toHaveCount(0);
  await expect(page.getByText("ずかんで つかわれます")).toHaveCount(0);
});

test("shows the special birthday text on the cat birthday", async ({ page }) => {
  await seedCatProfile(page, {
    now: "2026-06-13T00:00:00.000Z",
    birthDate: "2020-06-13",
  });

  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("きょうは 誕生日")).toBeVisible();
});

test("deletes a cat after confirmation and moves the active cat", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const now = new Date("2026-06-10T00:00:00.000Z").toISOString();
    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([
        {
          id: "cat-test",
          name: "ムギ",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "cat-mugi",
          name: "むぎ",
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );
    window.localStorage.setItem("active_cat_id", "cat-test");
    window.localStorage.setItem(
      "nyaruhodo_exchange_own_sleeping_photos",
      JSON.stringify([
        {
          id: "photo-test-cat",
          ownerCatId: "cat-test",
          catId: "cat-test",
          src:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lw5tWQAAAABJRU5ErkJggg==",
          state: "sleeping",
          visibility: "private",
          deliveryStatus: "available",
          triggerLabel: "sleeping",
          theme: "sleeping",
          shared: false,
          createdAt: Date.parse(now),
        },
      ]),
    );
  });

  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("cats-section-tab-basic").click();
  await page.getByRole("button", { name: "猫を追加・管理" }).click();
  await page.getByRole("button", { name: "この子を消す" }).click();
  await expect(page.getByText("ムギ・写真1枚 を消しますか？")).toBeVisible();
  await page.getByRole("button", { name: /^消す$/ }).click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const profiles = JSON.parse(
          window.localStorage.getItem("cat_profiles") ?? "[]",
        ) as { id: string; name: string }[];

        return {
          activeCatId: window.localStorage.getItem("active_cat_id"),
          names: profiles.map((profile) => profile.name),
          photoCount: JSON.parse(
            window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
              "[]",
          ).length,
        };
      }),
    )
    .toEqual({
      activeCatId: "cat-mugi",
      names: ["むぎ"],
      photoCount: 1,
    });
  await page.getByRole("button", { name: "猫を追加・管理" }).click();
  await expect(page.getByRole("button", { name: "この子を消す" })).toHaveCount(0);
});

async function seedCatProfile(
  page: import("@playwright/test").Page,
  { now, birthDate }: { now: string; birthDate: string },
) {
  await page.addInitScript(
    ({ now, birthDate }) => {
      const nowValue = Date.parse(now);
      const originalDateNow = Date.now.bind(Date);
      Date.now = () => nowValue || originalDateNow();
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "cat-mugi",
            name: "むぎ",
            createdAt: now,
            updatedAt: now,
            basicInfo: {
              familySinceDate: "2022-09-25",
              birthDate,
              gender: "female",
              breed: "ミックス",
            },
            appearance: {
              coat: "orange_tabby",
            },
          },
        ]),
      );
      window.localStorage.setItem("active_cat_id", "cat-mugi");
    },
    { now, birthDate },
  );
}
