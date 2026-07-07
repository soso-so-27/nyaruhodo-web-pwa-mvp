import { expect, test, type Page } from "@playwright/test";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

const timeSamples = [
  { key: "dawn", now: "2026-06-10T06:30:00+09:00" },
  { key: "noon", now: "2026-06-10T12:30:00+09:00" },
  { key: "evening", now: "2026-06-10T18:30:00+09:00" },
  { key: "night", now: "2026-06-10T21:30:00+09:00" },
] as const;

for (const sample of timeSamples) {
  test(`keeps the paper UI readable in the ${sample.key} theme`, async ({
    page,
  }) => {
    await seedCatsProfile(page, Date.parse(sample.now), 8);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/cats");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("cats-page")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.paperTheme))
      .toBe(sample.key);

    const theme = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      return {
        ink: styles.getPropertyValue("--ink").trim(),
        inkSoft: styles.getPropertyValue("--ink-soft").trim(),
        paperCard: styles.getPropertyValue("--paper-card").trim(),
        themeColor: styles.getPropertyValue("--app-theme-color").trim(),
        metaThemeColor:
          document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
            ?.content ?? "",
      };
    });

    expect(theme.themeColor).toBe(theme.metaThemeColor);
    expect(contrastRatio(theme.ink, theme.paperCard)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.inkSoft, theme.paperCard)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
}

test("keeps the cats photo tab clear of the fixed bottom navigation", async ({
  page,
}) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 8);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-photos").click();

  const grid = page.getByTestId("cats-lens-photo-grid");
  const photoItems = grid.locator(":scope > div");
  const tabs = page.getByTestId("cats-section-tabs");
  const cover = page.getByTestId("cats-profile-cover");
  const nav = page.getByRole("navigation");

  await expect(grid).toBeVisible();
  await expect(grid).toHaveAttribute("data-photo-decode-gate", "ready");
  await expect
    .poll(() =>
      grid.locator("img").evaluateAll((images) =>
        images.slice(0, 12).every((image) => {
          const element = image as HTMLImageElement;
          return element.complete && element.naturalWidth > 0;
        }),
      ),
    )
    .toBe(true);
  await expect(page.getByText("この子の写真")).toBeVisible();
  await expect(
    page.getByText("毎日のねがおと、とっておきが並びます。"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "とっておきを追加" })).toBeVisible();
  await expect(photoItems).toHaveCount(16);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.classList.contains("cats-scrollbar-quiet"),
      ),
    )
    .toBe(true);

  const gridMetrics = await page.evaluate(() => {
    const photoGrid = document.querySelector<HTMLElement>(
      '[data-testid="cats-lens-photo-grid"]',
    );
    return {
      columnGap: photoGrid ? getComputedStyle(photoGrid).columnGap : "",
    };
  });
  expect(gridMetrics.columnGap).toBe("4px");

  const [tabsBox, coverBox, navBoxBeforeScroll] = await Promise.all([
    tabs.boundingBox(),
    cover.boundingBox(),
    nav.boundingBox(),
  ]);
  expect(tabsBox?.height).toBe(48);
  expect(coverBox?.height).toBe(232);
  expect(coverBox?.width).toBeGreaterThanOrEqual(370);
  expect(navBoxBeforeScroll?.height).toBe(60);

  const lastPhoto = photoItems.last();
  await lastPhoto.scrollIntoViewIfNeeded();
  const [lastPhotoBox, navBox] = await Promise.all([
    lastPhoto.boundingBox(),
    nav.boundingBox(),
  ]);

  expect(lastPhotoBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect((lastPhotoBox?.y ?? 0) + (lastPhotoBox?.height ?? 0)).toBeLessThan(
    navBox?.y ?? 0,
  );
});

test("shows a quiet photo grid skeleton while cats photo thumbnails resolve", async ({
  page,
}) => {
  let releaseSignedUrl: () => void = () => {};
  const signedUrlGate = new Promise<void>((resolve) => {
    releaseSignedUrl = resolve;
  });
  let shouldDelayFirstThumbnail = true;

  await page.route("**/api/photo-storage/signed-url", async (route) => {
    const body = route.request().postDataJSON() as {
      src?: string;
      variant?: string;
    };

    if (shouldDelayFirstThumbnail && body.variant === "thumbnail") {
      shouldDelayFirstThumbnail = false;
      await signedUrlGate;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bucket: "cat-photos",
        expiresIn: 86_400,
        signedUrl: photoDataUrl,
        variant: body.variant ?? "thumbnail",
      }),
    });
  });

  await seedCatsProfileWithStoragePhotos(
    page,
    Date.parse("2026-06-10T12:30:00+09:00"),
    4,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("domcontentloaded");
  await page.getByTestId("cats-section-tab-photos").click();

  const grid = page.getByTestId("cats-lens-photo-grid");
  await expect(grid).toHaveAttribute("data-photo-decode-gate", "waiting");
  await expect(grid.locator("span")).toHaveCount(12);
  await expect(grid.locator("img")).toHaveCount(0);

  releaseSignedUrl();
  await expect(grid).toHaveAttribute("data-photo-decode-gate", "ready");
  await expect
    .poll(() =>
      grid.locator("img").evaluateAll((images) =>
        images.slice(0, 4).every((image) => {
          const element = image as HTMLImageElement;
          return element.complete && element.naturalWidth > 0;
        }),
      ),
    )
    .toBe(true);
});

test("switches to the next cat from the cover in one tap", async ({ page }) => {
  await seedMultipleCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "次のねこに切り替える" }).click();

  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem("active_cat_id")),
    )
    .toBe("cat-komugi");
});

test("lets the owner choose a cat thumbnail from existing photos", async ({
  page,
}) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("cats-section-tab-basic").click();
  await page.getByTestId("cats-thumbnail-picker-button").click();

  await expect(page.getByRole("dialog", { name: "サムネイル写真" })).toBeVisible();
  await page
    .getByRole("button", { name: /の写真をサムネイルにする/ })
    .first()
    .click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("cat_profiles");
        const [profile] = raw ? JSON.parse(raw) : [];
        return profile?.avatarDataUrl ?? "";
      }),
    )
    .toBe(photoDataUrl);
});

test("lets the owner drag the cat thumbnail crop directly", async ({ page }) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("cats-section-tab-basic").click();
  await page.getByTestId("cats-thumbnail-picker-button").click();
  await page.getByTestId("thumbnail-picker-photo").first().click();

  await expect(page.getByTestId("thumbnail-crop-sheet")).toBeVisible();
  await page.getByTestId("thumbnail-crop-preview").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const endX = startX + rect.width * 0.1;
    const endY = startY - rect.height * 0.1;
    const firePointer = (
      type: string,
      clientX: number,
      clientY: number,
    ) => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          isPrimary: true,
          pointerId: 1,
          pointerType: "touch",
        }),
      );
    };

    firePointer("pointerdown", startX, startY);
    firePointer("pointermove", endX, endY);
    firePointer("pointerup", endX, endY);
  });
  await page.getByTestId("thumbnail-crop-save").click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("cat_profiles");
        const [profile] = raw ? JSON.parse(raw) : [];
        return profile?.avatarCrop ?? null;
      }),
    )
    .toMatchObject({ scale: 1 });
  const crop = await page.evaluate(() => {
    const raw = window.localStorage.getItem("cat_profiles");
    const [profile] = raw ? JSON.parse(raw) : [];
    return profile?.avatarCrop ?? null;
  });
  expect(crop?.offsetX).toBeCloseTo(10, 4);
  expect(crop?.offsetY).toBeCloseTo(-10, 4);
});

test("lets the owner pinch to zoom the cat thumbnail crop", async ({ page }) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("cats-section-tab-basic").click();
  await page.getByTestId("cats-thumbnail-picker-button").click();
  await page.getByTestId("thumbnail-picker-photo").first().click();

  await expect(page.getByTestId("thumbnail-crop-sheet")).toBeVisible();
  await page.getByTestId("thumbnail-crop-preview").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const firePointer = (
      type: string,
      pointerId: number,
      clientX: number,
      clientY: number,
    ) => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          isPrimary: pointerId === 1,
          pointerId,
          pointerType: "touch",
        }),
      );
    };

    firePointer("pointerdown", 1, centerX - 30, centerY);
    firePointer("pointerdown", 2, centerX + 30, centerY);
    firePointer("pointermove", 1, centerX - 60, centerY);
    firePointer("pointermove", 2, centerX + 60, centerY);
    firePointer("pointerup", 1, centerX - 60, centerY);
    firePointer("pointerup", 2, centerX + 60, centerY);
  });
  await page.getByTestId("thumbnail-crop-save").click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("cat_profiles");
        const [profile] = raw ? JSON.parse(raw) : [];
        return profile?.avatarCrop?.scale ?? 0;
      }),
    )
    .toBe(2);
});

test("shows the custom top cover without over-cropping", async ({
  page,
}) => {
  const signedUrlRequests: Array<{ src?: string; variant?: string }> = [];

  await page.route("**/api/photo-storage/signed-url", async (route) => {
    const body = route.request().postDataJSON() as {
      src?: string;
      variant?: string;
    };
    signedUrlRequests.push(body);

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bucket: "cat-photos",
        expiresIn: 86_400,
        signedUrl: photoDataUrl,
        variant: body.variant ?? "display",
      }),
    });
  });

  await seedCatsProfileWithCustomStorageAvatar(
    page,
    Date.parse("2026-06-10T12:30:00+09:00"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  const coverImages = page.getByTestId("cats-profile-cover").locator("img");

  await expect(coverImages).toHaveCount(1);
  await expect
    .poll(() =>
      coverImages.first().evaluate((image) => {
        const element = image as HTMLImageElement;
        return element.complete && element.naturalWidth > 0;
      }),
    )
    .toBe(true);
  await expect
    .poll(() =>
      coverImages
        .first()
        .evaluate((image) => window.getComputedStyle(image).objectFit),
    )
    .toBe("contain");
  await expect
    .poll(() =>
      coverImages
        .first()
        .evaluate((image) => window.getComputedStyle(image).objectPosition),
    )
    .toBe("50% 30%");
  await page.getByTestId("cats-profile-cover").locator("button").click();
  await expect(page.getByRole("dialog", { name: "代表写真" })).toBeVisible();
  expect(signedUrlRequests.some((request) => request.src?.includes("/avatar/"))).toBe(
    true,
  );
});

test("shows only filled basic profile fields", async ({ page }) => {
  await seedCatsBasicProfile(page, {
    basicInfo: {
      familySinceDate: "2022-09-22",
      birthDate: "2022-07-10",
      gender: "male",
      personality: {
        favoriteTouch: "あごの下",
      },
    },
    appearance: {
      coat: "orange_tabby",
    },
  });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-basic").click();

  await expect(page.getByText("むぎのこと")).toBeVisible();
  await expect(page.getByText("たいせつな日")).toBeVisible();
  await expect(page.getByText("見た目")).toBeVisible();
  await expect(page.getByText("この子らしさ")).toBeVisible();
  await expect(page.getByText("毛柄")).toBeVisible();
  await expect(page.getByText("ケアのメモ")).toHaveCount(0);
  await expect(page.getByText("かかりつけ")).toHaveCount(0);
  await expect(page.getByText("ワクチンを打った日")).toHaveCount(0);
  await expect(page.getByText("未登録")).toHaveCount(0);
  await expect(page.getByText("なでられると好きなところ")).toBeVisible();
  await expect(page.getByText("あごの下")).toBeVisible();
  await expect(page.getByText("7月10日は「むぎの日」")).toHaveCount(0);
});

test("edits weight and mixed coat without showing the old breed field", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-07-02T12:00:00+09:00"));
  await seedCatsBasicProfile(page, {
    basicInfo: {
      familySinceDate: "2022-09-22",
      birthDate: "2022-07-10",
      breed: "ミックス",
    },
    appearance: {},
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-basic").click();

  await page.getByRole("button", { name: "基本情報を編集" }).click();
  const dialog = page.getByRole("dialog", { name: "むぎのことを 書く" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("あとから見返したいことだけ、少しずつ。")).toHaveCount(0);
  await expect(dialog.getByLabel("この子の名前")).toBeVisible();
  await expect(
    dialog.getByText("この日から、いっしょの日々をかぞえます。"),
  ).toHaveCount(0);
  await expect(dialog.getByText("猫種・タイプ")).toHaveCount(0);
  await expect(dialog.getByText("毛色")).toHaveCount(0);
  await expect(dialog.getByLabel("毛柄")).toBeVisible();
  await expect(dialog.getByLabel("猫種")).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    )
    .toBe(true);
  await expect(dialog.getByRole("radio", { name: "男の子" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "女の子" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "わからない" })).toBeVisible();
  await expect(dialog.getByLabel("猫種")).toHaveValue("ミックス");

  await dialog.getByLabel("毛柄").fill("茶トラ");
  await dialog.getByLabel("体重（kg）").fill("5.5");
  await dialog.getByLabel("ワクチンを打った日").fill("2026-06-01");
  await dialog.getByLabel("ワクチンのメモ").fill("3種混合");
  await dialog.getByRole("button", { name: "保存する" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("茶トラ")).toBeVisible();
  await expect(page.getByText("猫種")).toBeVisible();
  await expect(page.getByText("ミックス")).toBeVisible();
  await expect(page.getByText("5.5 kg")).toBeVisible();
  await expect(page.getByText("2026年7月2日")).toBeVisible();
  await expect(page.getByText("ワクチンを打った日")).toBeVisible();
  await expect(page.getByText("2026年6月1日")).toBeVisible();
  await expect(page.getByText("3種混合")).toBeVisible();
  await expect(page.getByText("最後に測った日")).toHaveCount(0);
  await expect(page.getByText("測定日")).toHaveCount(0);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("cat_profiles");
        const [profile] = raw ? JSON.parse(raw) : [];
        return {
          coat: profile?.appearance?.coat ?? "",
          breed: profile?.basicInfo?.breed ?? "",
          measuredDate: profile?.basicInfo?.care?.weightMeasuredDate ?? "",
          weightKg: profile?.basicInfo?.care?.weightKg ?? 0,
          vaccineDate: profile?.basicInfo?.care?.vaccineDate ?? "",
          vaccineNote: profile?.basicInfo?.care?.vaccineNote ?? "",
        };
      }),
    )
    .toEqual({
      coat: "茶トラ",
      breed: "ミックス",
      measuredDate: "2026-07-02",
      weightKg: 5.5,
      vaccineDate: "2026-06-01",
      vaccineNote: "3種混合",
    });
});

test("shows a meaningful pickup only when there is a strong cat record reason", async ({
  page,
}) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  const pickup = page.getByTestId("cats-pickup-section");
  await expect(pickup).toBeVisible();
  await expect(pickup).toContainText("今日の1件");
  await expect(pickup).toContainText("10枚目のねがお");
  await expect(page.getByText("思い出が")).toHaveCount(0);

  await pickup.getByRole("button").click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("neteruneko_cat_pickup_history") ?? "",
      ),
    )
    .toContain("milestone-10");
});

test("renders footprints as recent cat events instead of a photo-only list", async ({
  page,
}) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 12);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "足あと" })).toBeVisible();
  await expect(page.getByText("2026年6月")).toBeVisible();
  await expect(page.getByText("ねがおを撮った").first()).toBeVisible();
  await expect(page.getByText("届いた")).toHaveCount(0);
});

test("shows celebrations as current milestones instead of a fixed 50-photo card", async ({
  page,
}) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  const celebration = page
    .getByRole("heading", { name: "記念" })
    .locator("xpath=ancestor::section");

  await expect(celebration).toContainText("家族になって");
  await expect(celebration).toContainText("ねがお");
  await expect(celebration).toContainText("10 / 50枚");
  await expect(celebration).toContainText("誕生日");
});

test("opens a year summary dashboard from the yearly archive", async ({
  page,
}) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /2026年/ }).click();

  const dialog = page.getByRole("dialog", { name: "2026年" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("ねがお");
  await expect(dialog).toContainText("思い出");
  await expect(dialog).toContainText("記念");
  await expect(dialog).toContainText("6月によく撮りました");
  await expect(dialog).toContainText("10枚目");
});

async function seedCatsProfile(page: Page, now: number, photoCount: number) {
  await page.addInitScript(
    ({ nowValue, src, count }) => {
      (window as typeof window & { __testNow?: number }).__testNow = nowValue;
      const nowIso = new Date(nowValue).toISOString();
      window.localStorage.setItem("active_cat_id", "cat-mugi");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "cat-mugi",
            name: "\u3080\u304e",
            createdAt: nowIso,
            updatedAt: nowIso,
            basicInfo: {
              familySinceDate: "2022-09-22",
              birthDate: "2022-07-10",
              gender: "male",
              breed: "\u30df\u30c3\u30af\u30b9",
            },
            appearance: {
              coat: "orange_tabby",
            },
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify(
          Array.from({ length: count }, (_, index) => ({
            id: `own-sleeping-${index}`,
            ownerCatId: "cat-mugi",
            catId: "cat-mugi",
            src,
            thumbnailSrc: src,
            displaySrc: src,
            state: "sleeping",
            visibility: "private",
            deliveryStatus: "available",
            triggerLabel: "sleeping",
            theme: "sleeping",
            shared: index % 2 === 0,
            createdAt: nowValue - index * 86_400_000,
          })),
        ),
      );
      window.localStorage.setItem(
        "neteruneko_cat_gallery_photos",
        JSON.stringify(
          Array.from({ length: count }, (_, index) => ({
            id: `cat-gallery-${index}`,
            catId: "cat-mugi",
            src,
            createdAt: nowValue - index * 86_400_000,
          })),
        ),
      );
    },
    { nowValue: now, src: photoDataUrl, count: photoCount },
  );
}

async function seedCatsProfileWithStoragePhotos(
  page: Page,
  now: number,
  photoCount: number,
) {
  await page.addInitScript(
    ({ nowValue, count }) => {
      (window as typeof window & { __testNow?: number }).__testNow = nowValue;
      const nowIso = new Date(nowValue).toISOString();
      window.localStorage.setItem("active_cat_id", "cat-mugi");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "cat-mugi",
            name: "\u3080\u304e",
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify(
          Array.from({ length: count }, (_, index) => ({
            id: `own-storage-${index}`,
            ownerCatId: "cat-mugi",
            catId: "cat-mugi",
            src: `storage:cat-mugi/sleeping/${index}/display.webp`,
            thumbnailSrc: `storage:cat-mugi/sleeping/${index}/thumbnail.webp`,
            displaySrc: `storage:cat-mugi/sleeping/${index}/display.webp`,
            state: "sleeping",
            visibility: "private",
            deliveryStatus: "available",
            triggerLabel: "sleeping",
            theme: "sleeping",
            shared: false,
            createdAt: nowValue - index * 86_400_000,
          })),
        ),
      );
    },
    { nowValue: now, count: photoCount },
  );
}

async function seedCatsProfileWithCustomStorageAvatar(page: Page, now: number) {
  await page.addInitScript(({ nowValue }) => {
    (window as typeof window & { __testNow?: number }).__testNow = nowValue;
    const nowIso = new Date(nowValue).toISOString();
    window.localStorage.setItem("active_cat_id", "cat-mugi");
    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([
        {
          id: "cat-mugi",
          name: "\u3080\u304e",
          createdAt: nowIso,
          updatedAt: nowIso,
          avatarDataUrl: "storage:cat-mugi/avatar/avatar.webp",
        },
      ]),
    );
    window.localStorage.setItem(
      "nyaruhodo_exchange_own_sleeping_photos",
      JSON.stringify([
        {
          id: "own-auto-cover",
          ownerCatId: "cat-mugi",
          catId: "cat-mugi",
          src: "storage:cat-mugi/sleeping/auto/display.webp",
          thumbnailSrc: "storage:cat-mugi/sleeping/auto/thumbnail.webp",
          displaySrc: "storage:cat-mugi/sleeping/auto/display.webp",
          state: "sleeping",
          visibility: "private",
          deliveryStatus: "available",
          triggerLabel: "sleeping",
          theme: "sleeping",
          shared: false,
          createdAt: nowValue,
        },
      ]),
    );
  }, { nowValue: now });
}

async function seedCatsBasicProfile(
  page: Page,
  profilePatch: {
    basicInfo?: Record<string, unknown>;
    appearance?: Record<string, unknown>;
  },
) {
  await page.addInitScript(
    ({ patch, src }) => {
      const nowIso = new Date("2026-07-02T12:00:00+09:00").toISOString();
      window.localStorage.setItem("active_cat_id", "cat-mugi");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "cat-mugi",
            name: "\u3080\u304e",
            createdAt: nowIso,
            updatedAt: nowIso,
            basicInfo: patch.basicInfo ?? {},
            appearance: patch.appearance ?? {},
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "own-sleeping-basic",
            ownerCatId: "cat-mugi",
            catId: "cat-mugi",
            src,
            thumbnailSrc: src,
            displaySrc: src,
            state: "sleeping",
            visibility: "private",
            deliveryStatus: "available",
            triggerLabel: "sleeping",
            theme: "sleeping",
            shared: false,
            createdAt: Date.parse("2026-07-01T20:00:00+09:00"),
          },
        ]),
      );
    },
    { patch: profilePatch, src: photoDataUrl },
  );
}

async function seedMultipleCatsProfile(page: Page, now: number) {
  await page.addInitScript(
    ({ nowValue, src }) => {
      (window as typeof window & { __testNow?: number }).__testNow = nowValue;
      const nowIso = new Date(nowValue).toISOString();
      window.localStorage.setItem("active_cat_id", "cat-mugi");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "cat-mugi",
            name: "\u3080\u304e",
            createdAt: nowIso,
            updatedAt: nowIso,
            basicInfo: {
              familySinceDate: "2022-09-22",
              birthDate: "2022-07-10",
              gender: "male",
              breed: "\u30df\u30c3\u30af\u30b9",
            },
            appearance: {
              coat: "orange_tabby",
            },
          },
          {
            id: "cat-komugi",
            name: "\u3053\u3080\u304e",
            createdAt: nowIso,
            updatedAt: nowIso,
            basicInfo: {
              familySinceDate: "2024-04-01",
              birthDate: "2024-02-14",
              gender: "female",
              breed: "\u30df\u30c3\u30af\u30b9",
            },
            appearance: {
              coat: "calico",
            },
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "own-sleeping-mugi",
            ownerCatId: "cat-mugi",
            catId: "cat-mugi",
            src,
            thumbnailSrc: src,
            displaySrc: src,
            state: "sleeping",
            visibility: "private",
            deliveryStatus: "available",
            triggerLabel: "sleeping",
            theme: "sleeping",
            shared: true,
            createdAt: nowValue,
          },
        ]),
      );
    },
    { nowValue: now, src: photoDataUrl },
  );
}

function contrastRatio(foreground: string, background: string) {
  const fore = relativeLuminance(parseCssColor(foreground));
  const back = relativeLuminance(parseCssColor(background));
  const lighter = Math.max(fore, back);
  const darker = Math.min(fore, back);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance([red, green, blue]: [number, number, number]) {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function parseCssColor(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    const normalized = color.slice(1);
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ];
  }

  const channels = color.match(/\d+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length < 3) {
    throw new Error(`Unsupported color: ${color}`);
  }

  return [channels[0], channels[1], channels[2]];
}
