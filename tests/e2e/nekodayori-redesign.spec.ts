import { expect, test, type Page } from "@playwright/test";
import { encode } from "jpeg-js";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

function createPhotoDataUrl(index: number, width = 32, height = 24) {
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const bit = (index >> ((Math.floor(x / 8) + Math.floor(y / 8)) % 6)) & 1;
      pixels[offset] = (index * 47 + (bit ? 96 : 0)) % 256;
      pixels[offset + 1] = (index * 83 + (bit ? 32 : 144)) % 256;
      pixels[offset + 2] = (index * 127 + (bit ? 176 : 48)) % 256;
      pixels[offset + 3] = 255;
    }
  }

  const jpeg = encode({ data: pixels, width, height }, 70).data;
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

test.describe("nekodayori redesign", () => {
  test("keeps own cats out of the main nekodayori view", async ({ page }) => {
    const createdAt = Date.parse("2026-07-24T10:00:00+09:00");
    await seedCat(page);
    await page.addInitScript(
      ({ src, createdAt }) => {
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "own-photo-only",
              ownerCatId: "nekodayori-cat",
              catId: "nekodayori-cat",
              src,
              state: "sleeping",
              visibility: "shared",
              deliveryStatus: "available",
              shared: true,
              triggerLabel: "sleeping",
              theme: "sleeping",
              createdAt,
            },
          ]),
        );
      },
      { src: photoDataUrl, createdAt },
    );

    await page.goto("/collection");

    await expect(page.getByRole("heading", { name: "ねこだより" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "わたしのねがお" })).toHaveCount(
      0,
    );
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(0);
    await expect(page.getByTestId("nekodayori-history")).toHaveCount(0);
    await expect(
      page.getByText(
        "「きょう」で写真を1枚撮ると、今夜ねこだよりが届きます。",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "きょうの一枚を撮る" }),
    ).toHaveAttribute("href", "/home");
    await expect(
      page.getByRole("button", { name: "ねこだよりに送る写真の設定" }),
    ).toHaveCount(0);

    await page.goto("/collection?manage=sent&from=collection&keep=1");
    await page.evaluate(() => {
      window.history.replaceState(
        {
          ...window.history.state,
          collectionCloseStateSentinel: "keep-me",
        },
        "",
        window.location.href,
      );
    });
    await expect(page.getByTestId("mainichi-board-photo-sent")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "ねこだよりに送る写真の設定",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "ねこだよりへ戻る" }).click();
    await expect(page).toHaveURL(/\/collection\?keep=1$/);
    await expect
      .poll(() =>
        page.evaluate(
          () => window.history.state?.collectionCloseStateSentinel ?? null,
        ),
      )
      .toBe("keep-me");
    await expect(
      page.getByRole("heading", { name: "ねこだより", exact: true }),
    ).toBeVisible();
  });

  test("shows a pending four-cat delivery without adding it to history", async ({
    page,
  }) => {
    const now = Date.parse("2026-07-24T20:10:00+09:00");
    const dateKey = "2026-07-24";
    await page.clock.setFixedTime(new Date(now));
    await seedCat(page);
    await page.addInitScript(
      ({ src, deliveredAt, targetDateKey }) => {
        const deliveredPhotos = Array.from({ length: 4 }, (_, index) => ({
          id: `pending-cat-${index + 1}`,
          sourcePhotoId: `pending-source-${index + 1}`,
          src,
          title: "ねこだより",
          subtitle: "",
          triggerLabel: "sleeping",
          theme: "sleeping",
          deliveredAt,
        }));
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [targetDateKey]: {
              dateKey: targetDateKey,
              targetOwnPhotoId: "today-own-photo",
              targetCatId: "nekodayori-cat",
              targetCapturedAt: deliveredAt - 60_000,
              deliveredPhoto: deliveredPhotos[0],
              deliveredPhotos,
              deliveredAt,
              servedVariant: "four_choice_v1",
              requestedCount: 4,
              servedCount: 4,
            },
          }),
        );
      },
      { src: photoDataUrl, deliveredAt: now, targetDateKey: dateKey },
    );

    await page.goto("/collection");

    const current = page.getByTestId("nekodayori-current");
    await expect(current).toHaveAttribute("data-state", "pending");
    await expect(current).toContainText("ねこだよりが届きました");
    await expect(current).not.toContainText("4匹");
    const pendingLink = page.getByRole("link", { name: "「きょう」で選ぶ" });
    await expect(pendingLink).toHaveAttribute("href", "/home");
    await expect(current).toContainText(
      "「きょう」で、残したい猫を選べます。",
    );
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(
      0,
    );
    await pendingLink.click();
    await expect(page.getByTestId("desk-open-letter")).toBeVisible();
  });

  test("features tonight's selected cat and keeps older cats in history", async ({
    page,
  }) => {
    const now = Date.parse("2026-07-24T20:20:00+09:00");
    const olderAt = Date.parse("2026-06-15T20:00:00+09:00");
    await page.clock.setFixedTime(new Date(now));
    await seedCat(page);
    await page.addInitScript(
      ({ src, sameDaySrc, olderSrc, selectedAt, olderDeliveredAt }) => {
        const selectedPhoto = {
          id: "selected-tonight",
          sourcePhotoId: "selected-tonight-source",
          src,
          title: "ねこだより",
          subtitle: "",
          triggerLabel: "sleeping",
          theme: "sleeping",
          deliveredAt: selectedAt,
        };
        const olderPhoto = {
          id: "selected-older",
          sourcePhotoId: "selected-older-source",
          src: olderSrc,
          title: "ねこだより",
          subtitle: "",
          triggerLabel: "sleeping",
          theme: "sleeping",
          deliveredAt: olderDeliveredAt,
        };
        const sameDayPhoto = {
          id: "selected-same-day-earlier",
          sourcePhotoId: "selected-same-day-earlier-source",
          src: sameDaySrc,
          title: "ねこだより",
          subtitle: "",
          triggerLabel: "sleeping",
          theme: "sleeping",
          deliveredAt: selectedAt - 60_000,
        };
        window.localStorage.setItem(
          "nyaruhodo_exchange_kept_photos",
          JSON.stringify([sameDayPhoto, selectedPhoto, olderPhoto]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            "2026-07-24": {
              dateKey: "2026-07-24",
              targetOwnPhotoId: "today-own-photo",
              targetCatId: "nekodayori-cat",
              deliveredPhoto: selectedPhoto,
              selectedPhotoId: selectedPhoto.id,
              deliveredAt: selectedAt,
              openedAt: selectedAt + 1,
              keptAt: selectedAt + 1,
              servedVariant: "four_choice_v1",
              requestedCount: 4,
              servedCount: 4,
            },
          }),
        );
      },
      {
        src: photoDataUrl,
        sameDaySrc: createPhotoDataUrl(3),
        olderSrc: createPhotoDataUrl(2),
        selectedAt: now,
        olderDeliveredAt: olderAt,
      },
    );

    await page.goto("/collection");

    const current = page.getByTestId("nekodayori-current");
    await expect(current).toHaveAttribute(
      "data-state",
      "saved",
    );
    await expect(page.getByTestId("nekodayori-current-saved-photo")).toHaveAttribute(
      "data-photo-id",
      "selected-tonight",
    );
    await expect(current).toContainText("きょうのねこだより");
    await expect(current).not.toContainText("4匹");
    await expect(current).not.toContainText("えらんだ");
    const historyPhotos = page.getByTestId("mainichi-board-photo-delivered");
    await expect(historyPhotos).toHaveCount(1);
    await expect(historyPhotos).toHaveAttribute(
      "data-photo-id",
      "selected-same-day-earlier",
    );
    await expect(page.getByTestId("nekodayori-history-gallery")).toHaveAttribute(
      "data-layout",
      "two-column",
    );
    await expect(page.getByTestId("nekodayori-history-date")).toHaveText(
      "7月24日",
    );
    const monthSelect = page.getByTestId("mainichi-month-select");
    await expect(monthSelect).toContainText("2026年7月");
    await monthSelect.click();
    await expect(
      page.getByTestId("mainichi-month-picker-row-2026-06"),
    ).toBeVisible();
    await page.getByTestId("mainichi-month-picker-row-2026-07").click();

    if (process.env.CAPTURE_NEKODAYORI_HISTORY_GALLERY === "1") {
      await page.screenshot({
        path: "artifacts/nekodayori-history-with-current-mobile-2026-07-24.png",
        fullPage: true,
        animations: "disabled",
      });
    }

    await page.getByTestId("nekodayori-current-saved-photo").click();
    const photoScroll = page.getByTestId("box-photo-scroll");
    await expect(photoScroll).toHaveAttribute(
      "data-current-photo-id",
      "selected-tonight",
    );
  });

  test("opens the latest non-empty history month instead of an empty current month", async ({
    page,
  }) => {
    const now = Date.parse("2026-07-24T12:00:00+09:00");
    const olderAt = Date.parse("2026-06-15T20:00:00+09:00");
    await page.clock.setFixedTime(new Date(now));
    await seedCat(page);
    await seedKeptPhoto(page, {
      id: "june-history-photo",
      deliveredAt: olderAt,
    });

    await page.goto("/collection");

    await expect(page.getByTestId("mainichi-month-select")).toHaveCount(0);
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(
      1,
    );
    await expect(page.getByTestId("nekodayori-history-date")).toHaveText(
      "6月15日",
    );
    await expect(page.getByTestId("mainichi-board-empty")).toHaveCount(0);
  });

  test("shows older cats in a two-column dated gallery", async ({ page }) => {
    const now = Date.parse("2026-07-24T12:00:00+09:00");
    await page.clock.setFixedTime(new Date(now));
    await seedCat(page);
    await page.addInitScript(
      ({ photos }) => {
        window.localStorage.setItem(
          "nyaruhodo_exchange_kept_photos",
          JSON.stringify(photos),
        );
      },
      {
        photos: [
          {
            id: "history-jul-21",
            sourcePhotoId: "history-jul-21-source",
            src: createPhotoDataUrl(21, 24, 36),
            title: "ねこだより",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.parse("2026-07-21T20:00:00+09:00"),
          },
          {
            id: "history-jul-23",
            sourcePhotoId: "history-jul-23-source",
            src: createPhotoDataUrl(23, 40, 24),
            title: "ねこだより",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.parse("2026-07-23T20:00:00+09:00"),
          },
          {
            id: "history-jul-20",
            sourcePhotoId: "history-jul-20-source",
            src: createPhotoDataUrl(20, 32, 32),
            title: "ねこだより",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.parse("2026-07-20T20:00:00+09:00"),
          },
          {
            id: "history-jul-22",
            sourcePhotoId: "history-jul-22-source",
            src: createPhotoDataUrl(22, 24, 32),
            title: "ねこだより",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: Date.parse("2026-07-22T20:00:00+09:00"),
          },
        ],
      },
    );

    await page.goto("/collection");

    const gallery = page.getByTestId("nekodayori-history-gallery");
    const cards = page.getByTestId("mainichi-board-photo-delivered");
    await expect(gallery).toHaveAttribute("data-layout", "two-column");
    await expect(cards).toHaveCount(4);
    await expect(cards.first()).toHaveAttribute("data-photo-frame", "gallery");
    expect(
      await cards.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-photo-id")),
      ),
    ).toEqual([
      "history-jul-23",
      "history-jul-22",
      "history-jul-21",
      "history-jul-20",
    ]);
    await expect(page.getByTestId("nekodayori-history-date")).toHaveText([
      "7月23日",
      "7月22日",
      "7月21日",
      "7月20日",
    ]);

    const positions = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
      }),
    );
    expect(Math.abs(positions[0].top - positions[1].top)).toBeLessThan(2);
    expect(positions[0].left).toBeLessThan(positions[1].left);
    expect(positions[2].top).toBeGreaterThan(positions[0].top);

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    const lastDateBox = await page
      .getByTestId("nekodayori-history-date")
      .nth(3)
      .boundingBox();
    const bottomNavBox = await page.locator("[data-app-bottom-nav]").boundingBox();
    expect(lastDateBox).not.toBeNull();
    expect(bottomNavBox).not.toBeNull();
    expect(lastDateBox!.y + lastDateBox!.height).toBeLessThan(
      bottomNavBox!.y - 8,
    );

    if (process.env.CAPTURE_NEKODAYORI_HISTORY_GALLERY === "1") {
      await page.screenshot({
        path: "artifacts/nekodayori-history-gallery-mobile-2026-07-24.png",
        fullPage: true,
        animations: "disabled",
      });
    }
  });

  test("does not turn a skipped delivery into a saved cat", async ({ page }) => {
    const now = Date.parse("2026-07-24T20:20:00+09:00");
    const olderAt = Date.parse("2026-06-15T20:00:00+09:00");
    await page.clock.setFixedTime(new Date(now));
    await seedCat(page);
    await seedKeptPhoto(page, {
      id: "older-kept-after-skip",
      deliveredAt: olderAt,
    });
    await page.addInitScript(({ skippedAt }) => {
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify({
          "2026-07-24": {
            dateKey: "2026-07-24",
            targetOwnPhotoId: "today-own-photo",
            skippedAt,
          },
        }),
      );
    }, { skippedAt: now });

    await page.goto("/collection");

    await expect(page.getByTestId("nekodayori-page")).toHaveAttribute(
      "data-current-state",
      "skipped",
    );
    await expect(page.getByTestId("nekodayori-current")).toHaveCount(0);
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(
      1,
    );
  });

  test("shows a quiet waiting state after today's own photo is reserved", async ({
    page,
  }) => {
    const now = Date.parse("2026-07-24T01:00:00+09:00");
    await page.clock.setFixedTime(new Date(now));
    await seedCat(page);
    await page.addInitScript(({ targetAt }) => {
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify({
          "2026-07-24": {
            dateKey: "2026-07-24",
            targetOwnPhotoId: "today-own-photo",
            targetCatId: "nekodayori-cat",
            targetCapturedAt: targetAt,
          },
        }),
      );
    }, { targetAt: now });

    await page.goto("/collection");

    const current = page.getByTestId("nekodayori-current");
    await expect(current).toHaveAttribute("data-state", "waiting");
    await expect(current).toContainText(
      "よる8時ごろ、ねこだよりが届きます。",
    );
  });

  test("keeps a single-photo fallback visible after it is opened", async ({
    page,
  }) => {
    const now = Date.parse("2026-07-24T20:20:00+09:00");
    await page.clock.setFixedTime(new Date(now));
    await seedCat(page);
    await page.addInitScript(
      ({ src, openedAt }) => {
        const deliveredPhoto = {
          id: "single-fallback-kept",
          sourcePhotoId: "single-fallback-kept-source",
          src,
          title: "ねこだより",
          subtitle: "",
          triggerLabel: "sleeping",
          theme: "sleeping",
          deliveredAt: openedAt - 1,
        };
        window.localStorage.setItem(
          "nyaruhodo_exchange_kept_photos",
          JSON.stringify([deliveredPhoto]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            "2026-07-24": {
              dateKey: "2026-07-24",
              targetOwnPhotoId: "today-own-photo",
              targetCatId: "nekodayori-cat",
              deliveredPhoto,
              deliveredAt: openedAt - 1,
              openedAt,
              keptAt: openedAt,
              servedVariant: "single_v1",
              requestedCount: 4,
              servedCount: 1,
            },
          }),
        );
      },
      { src: photoDataUrl, openedAt: now },
    );

    await page.goto("/collection");

    await expect(page.getByTestId("nekodayori-current")).toHaveAttribute(
      "data-state",
      "saved",
    );
    await expect(page.getByTestId("nekodayori-current-saved-photo")).toHaveAttribute(
      "data-photo-id",
      "single-fallback-kept",
    );
  });

  test("shows an onboarding selection once as the current saved cat", async ({
    page,
  }) => {
    const now = Date.parse("2026-07-24T01:00:00+09:00");
    await page.clock.setFixedTime(new Date(now));
    await seedCat(page);
    await page.addInitScript(
      ({ src, selectedAt }) => {
        const deliveredPhoto = {
          id: "onboarding-selected",
          sourcePhotoId: "onboarding-selected-source",
          src,
          title: "ねこだより",
          subtitle: "",
          triggerLabel: "onboarding",
          theme: "mainichi",
          deliveredAt: selectedAt,
        };
        window.localStorage.setItem(
          "neteruneko_onboarding_progress",
          JSON.stringify({
            version: 1,
            anonymousId: "nekodayori-onboarding-anon",
            dateKey: "2026-07-24",
            stage: "opened",
            source: "direct",
            submissionId: "nekodayori-onboarding-submission",
            deliveredPhoto,
            deliveredPhotos: [deliveredPhoto],
            isDeliveredPhotoKept: true,
            updatedAt: selectedAt,
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_kept_photos",
          JSON.stringify([deliveredPhoto]),
        );
      },
      { src: photoDataUrl, selectedAt: now },
    );

    await page.goto("/collection");

    await expect(page.getByTestId("nekodayori-current")).toHaveAttribute(
      "data-state",
      "saved",
    );
    await expect(page.getByTestId("nekodayori-current-saved-photo")).toHaveAttribute(
      "data-photo-id",
      "onboarding-selected",
    );
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(
      0,
    );
  });
});

async function seedCat(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("active_cat_id", "nekodayori-cat");
    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([{ id: "nekodayori-cat", name: "むぎ" }]),
    );
  });
}

async function seedKeptPhoto(
  page: Page,
  {
    id,
    deliveredAt,
  }: {
    id: string;
    deliveredAt: number;
  },
) {
  await page.addInitScript(
    ({ src, photoId, timestamp }) => {
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify([
          {
            id: photoId,
            sourcePhotoId: `${photoId}-source`,
            src,
            title: "ねこだより",
            subtitle: "",
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: timestamp,
          },
        ]),
      );
    },
    { src: photoDataUrl, photoId: id, timestamp: deliveredAt },
  );
}
