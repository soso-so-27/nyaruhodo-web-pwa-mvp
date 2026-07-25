import { expect, test, type Page } from "@playwright/test";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";
const portraitPhotoDataUrl =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9PjsBCgsLDg0OHBAQHDsoIig7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O//AABEIACgAHgMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AJlFeU2exFkirUtm0WSKtS2bRY8LU3N0yBVrRs8mLJFWpbNoskVals3ix4WpubJkCitGzyYseq1LZvFkirUtm0WSBals2TK6rWjZ5UWSKtS2bRZIq1LZtFkgFTc2TK6rWjZ5UWSKtS2bRZIq1LZvFjwtTc2TP//Z";
const photoUploadBuffer = Buffer.from(photoDataUrl.split(",")[1], "base64");

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

test("keeps the cats photo tab clear of the fixed bottom navigation", async ({ page }) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 8);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  const grid = page.getByTestId("cats-lens-photo-grid");
  const photoItems = grid.locator(":scope > div");
  const tabs = page.getByTestId("cats-section-tabs");
  const sectionTabs = tabs.getByRole("radio");
  const nav = page.getByRole("navigation");

  await expect(page.getByTestId("cats-section-tab-photos")).toHaveAttribute("aria-checked", "true");
  await expect(sectionTabs).toHaveText(["写真", "記録", "プロフィール"]);
  await expect(page.getByTestId("cats-active-cat-name")).toHaveText("むぎ");
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
  await expect(page.getByTestId("cats-profile-cover")).toHaveCount(0);
  await expect(page.getByTestId("cats-photo-highlights")).toHaveAttribute("data-layout", "pair");
  await expect(page.getByTestId("cats-photo-today-card")).toContainText("きょうのむぎ");
  await expect(page.getByTestId("cats-photo-memory-card")).toBeVisible();
  await expect(page.getByTestId("cats-photo-delivery-bridge")).toHaveCount(0);
  await expect(page.getByTestId("cats-photo-current-month")).toHaveText("6月のむぎ");
  await expect(page.getByText("16枚", { exact: true })).toBeVisible();
  await expect(photoItems.first().getByText("6/10", { exact: true })).toBeVisible();
  await expect(page.getByTestId("cats-photo-lens-filter")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "写真を追加" })).toBeVisible();
  await expect(photoItems).toHaveCount(16);
  await expect(grid.locator('[data-app-pressable="photo"]')).toHaveCount(16);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("cats-scrollbar-quiet")),
    )
    .toBe(true);

  const gridMetrics = await page.evaluate(() => {
    const photoGrid = document.querySelector<HTMLElement>('[data-testid="cats-lens-photo-grid"]');
    const firstTile = photoGrid?.querySelector<HTMLButtonElement>(":scope > div button");
    const firstFrame = firstTile?.querySelector<HTMLElement>("span");
    const firstImage = firstTile?.querySelector<HTMLImageElement>("img");
    const items = photoGrid
      ? Array.from(photoGrid.querySelectorAll<HTMLElement>(":scope > div"))
      : [];
    const firstRect = items[0]?.getBoundingClientRect();
    const secondRect = items[1]?.getBoundingClientRect();
    const fourthRect = items[3]?.getBoundingClientRect();
    const frameRect = firstFrame?.getBoundingClientRect();
    return {
      columnGap: photoGrid ? getComputedStyle(photoGrid).columnGap : "",
      rowGap: photoGrid ? getComputedStyle(photoGrid).rowGap : "",
      frameBorderWidth: firstFrame ? getComputedStyle(firstFrame).borderWidth : "",
      frameBorderRadius: firstFrame ? getComputedStyle(firstFrame).borderRadius : "",
      frameBoxShadow: firstFrame ? getComputedStyle(firstFrame).boxShadow : "",
      imageObjectFit: firstImage ? getComputedStyle(firstImage).objectFit : "",
      itemWidth: firstRect?.width ?? 0,
      frameWidth: frameRect?.width ?? 0,
      horizontalGap: firstRect && secondRect ? secondRect.left - firstRect.right : 0,
      verticalGap: firstRect && fourthRect ? fourthRect.top - firstRect.bottom : 0,
      verticalPhotoGap: frameRect && fourthRect ? fourthRect.top - frameRect.bottom : 0,
    };
  });
  expect(gridMetrics.columnGap).toBe("2px");
  expect(gridMetrics.rowGap).toBe("2px");
  expect(gridMetrics.frameBorderWidth).toBe("0px");
  expect(gridMetrics.frameBorderRadius).toBe("1px");
  expect(gridMetrics.frameBoxShadow).toBe("none");
  expect(gridMetrics.imageObjectFit).toBe("cover");
  expect(gridMetrics.frameWidth).toBeCloseTo(gridMetrics.itemWidth, 5);
  expect(gridMetrics.horizontalGap).toBeCloseTo(2, 5);
  expect(gridMetrics.verticalGap).toBeGreaterThanOrEqual(2);
  expect(gridMetrics.verticalPhotoGap).toBeGreaterThan(2);
  expect(gridMetrics.verticalPhotoGap).toBeLessThan(32);

  const [tabsBox, navBoxBeforeScroll] = await Promise.all([tabs.boundingBox(), nav.boundingBox()]);
  expect(tabsBox?.height).toBe(48);
  expect(navBoxBeforeScroll?.height).toBe(60);

  const lastPhoto = photoItems.last();
  await lastPhoto.scrollIntoViewIfNeeded();
  const [lastPhotoBox, navBox] = await Promise.all([lastPhoto.boundingBox(), nav.boundingBox()]);

  expect(lastPhotoBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect((lastPhotoBox?.y ?? 0) + (lastPhotoBox?.height ?? 0)).toBeLessThan(navBox?.y ?? 0);

  await page.getByRole("button", { name: "写真を追加" }).click();
  await expect(page.getByText("追加した写真は、ねこだよりには使われません。")).toBeVisible();
});

test("does not treat a same-day gallery photo as today's daily photo", async ({ page }) => {
  const now = Date.parse("2026-07-23T20:30:00+09:00");
  await seedCatsPhotoTabState(page, {
    now,
    sleepingPhotos: [
      {
        id: "own-sleeping-yesterday",
        createdAt: Date.parse("2026-07-22T19:00:00+09:00"),
      },
    ],
    galleryPhotos: [
      {
        id: "cat-gallery-today",
        createdAt: Date.parse("2026-07-23T20:00:00+09:00"),
      },
    ],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("cats-photo-highlights")).toHaveAttribute("data-layout", "single");
  await expect(page.getByTestId("cats-photo-today-card")).toHaveCount(0);
  await expect(page.getByTestId("cats-photo-memory-card")).toHaveAttribute(
    "data-photo-id",
    "own-sleeping-yesterday",
  );
  await expect(page.getByTestId("cats-photo-today-link")).toHaveAttribute("href", "/home");
  await expect(page.getByTestId("cats-photo-delivery-bridge")).toHaveCount(0);
  await expect(page.getByTestId("cats-photo-current-month")).toHaveText("7月のむぎ");
  await expect(page.getByTestId("cats-lens-photo-grid").locator(":scope > div")).toHaveCount(2);
  await expect(page.getByTestId("cats-photo-older")).toHaveCount(0);
});

test("changes sharing only from a sleeping photo detail", async ({ page }) => {
  const now = Date.parse("2026-07-23T20:30:00+09:00");
  const sleepingPhotoId = "own-sleeping-sharing-setting";
  const galleryPhotoId = "cat-gallery-private-photo";

  await page.route("**/api/sleeping-delivery/backup", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, existing: true }),
    });
  });
  await seedCatsPhotoTabState(page, {
    now,
    sleepingPhotos: [
      {
        id: sleepingPhotoId,
        createdAt: Date.parse("2026-07-23T19:00:00+09:00"),
        shared: true,
      },
    ],
    galleryPhotos: [
      {
        id: galleryPhotoId,
        createdAt: Date.parse("2026-07-22T19:00:00+09:00"),
      },
    ],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  const grid = page.getByTestId("cats-lens-photo-grid");
  await grid.getByRole("button", { name: "7/23のむぎ" }).click();

  const viewer = page.getByTestId("cats-photo-viewer");
  const sharingToggle = viewer.getByRole("switch", {
    name: "この写真をほかのおうちへ送る",
  });
  await expect(viewer).toHaveAttribute("data-photo-id", sleepingPhotoId);
  await expect(page.getByTestId("cats-photo-delivery-setting")).toBeVisible();
  await expect(sharingToggle).toBeChecked();
  await expect(page.getByTestId("cats-photo-delivery-status")).toHaveText(
    "ねこだよりとして届く候補です",
  );

  await sharingToggle.click();
  await expect(sharingToggle).not.toBeChecked();
  await expect(page.getByTestId("cats-photo-delivery-status")).toHaveText(
    "この写真は今後送られません",
  );
  await expect
    .poll(() =>
      page.evaluate((photoId) => {
        const photos = JSON.parse(
          window.localStorage.getItem(
            "nyaruhodo_exchange_own_sleeping_photos",
          ) ?? "[]",
        ) as { id?: string; shared?: boolean; visibility?: string }[];
        const photo = photos.find((candidate) => candidate.id === photoId);

        return {
          shared: photo?.shared,
          visibility: photo?.visibility,
        };
      }, sleepingPhotoId),
    )
    .toEqual({ shared: false, visibility: "private" });

  await sharingToggle.click();
  await expect(sharingToggle).toBeChecked();
  await expect(page.getByTestId("cats-photo-delivery-status")).toHaveText(
    "ねこだよりとして届く候補です",
  );
  await expect
    .poll(() =>
      page.evaluate((photoId) => {
        const photos = JSON.parse(
          window.localStorage.getItem(
            "nyaruhodo_exchange_own_sleeping_photos",
          ) ?? "[]",
        ) as { id?: string; shared?: boolean; visibility?: string }[];
        const photo = photos.find((candidate) => candidate.id === photoId);

        return {
          shared: photo?.shared,
          visibility: photo?.visibility,
        };
      }, sleepingPhotoId),
    )
    .toEqual({ shared: true, visibility: "shared" });

  await viewer.getByRole("button", { name: "この写真を削除" }).click();
  const sleepingPhotoDeleteDialog = page.getByRole("dialog", {
    name: "この写真を削除",
  });
  await expect(sleepingPhotoDeleteDialog).toContainText(
    "今後のねこだよりには使われません。",
  );
  await sleepingPhotoDeleteDialog.getByRole("button", { name: "やめる" }).click();

  await viewer.getByRole("button", { name: "写真を閉じる" }).click();
  await grid.getByRole("button", { name: "7/22のむぎ" }).click();

  await expect(viewer).toHaveAttribute("data-photo-id", galleryPhotoId);
  await expect(
    viewer.getByRole("switch", {
      name: "この写真をほかのおうちへ送る",
    }),
  ).toHaveCount(0);
  await expect(page.getByTestId("cats-photo-delivery-setting")).toHaveCount(0);
});

for (const viewport of [
  { width: 320, height: 568, label: "small mobile" },
  { width: 390, height: 844, label: "standard mobile" },
] as const) {
  test(`keeps the photo detail controls in view on ${viewport.label}`, async ({
    page,
  }, testInfo) => {
    const now = Date.parse("2026-07-23T20:30:00+09:00");

    await page.route("**/api/sleeping-delivery/backup", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, existing: true }),
      });
    });
    await seedCatsPhotoTabState(page, {
      now,
      src: portraitPhotoDataUrl,
      sleepingPhotos: [
        {
          id: `own-sleeping-${viewport.width}`,
          createdAt: Date.parse("2026-07-23T19:00:00+09:00"),
          shared: true,
        },
      ],
      galleryPhotos: [],
    });
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/cats");
    await page.waitForLoadState("networkidle");

    await page
      .getByTestId("cats-lens-photo-grid")
      .getByRole("button", { name: "7/23のむぎ" })
      .click();

    const viewer = page.getByTestId("cats-photo-viewer");
    const content = page.getByTestId("cats-photo-viewer-content");
    const image = page.getByTestId("cats-photo-viewer-image");
    const setting = page.getByTestId("cats-photo-delivery-setting");
    const closeButton = page.getByTestId("cats-photo-viewer-close");
    const deleteButton = viewer.getByRole("button", {
      name: "この写真を削除",
    });
    const sharingToggle = viewer.getByRole("switch", {
      name: "この写真をほかのおうちへ送る",
    });

    await expect(viewer).toBeVisible();
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("data-fit-ready", "true");
    await expect(setting).toBeVisible();
    await expect(closeButton).toHaveText("とじる");
    await expect(deleteButton).toBeVisible();
    await expect(page.getByTestId("cats-photo-delivery-state")).toHaveText(
      "送る",
    );

    const layout = await page.evaluate(() => {
      const readRect = (testId: string) => {
        const element = document.querySelector<HTMLElement>(
          `[data-testid="${testId}"]`,
        );
        const rect = element?.getBoundingClientRect();

        return rect
          ? {
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }
          : null;
      };
      const deleteElement = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((button) => button.textContent?.trim() === "この写真を削除");
      const deleteRect = deleteElement?.getBoundingClientRect();

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        rects: {
          content: readRect("cats-photo-viewer-content"),
          image: readRect("cats-photo-viewer-image"),
          setting: readRect("cats-photo-delivery-setting"),
          close: readRect("cats-photo-viewer-close"),
          delete: deleteRect
            ? {
                top: deleteRect.top,
                right: deleteRect.right,
                bottom: deleteRect.bottom,
                left: deleteRect.left,
                width: deleteRect.width,
                height: deleteRect.height,
              }
            : null,
        },
      };
    });

    for (const rect of Object.values(layout.rects)) {
      expect(rect).not.toBeNull();
      if (!rect) {
        continue;
      }
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(layout.viewportWidth);
      expect(rect.bottom).toBeLessThanOrEqual(layout.viewportHeight);
    }
    const [closeHitHeight, deleteHitHeight, toggleHitHeight] =
      await Promise.all([
        closeButton.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).height),
        ),
        deleteButton.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).height),
        ),
        sharingToggle.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).height),
        ),
      ]);
    expect(closeHitHeight).toBeGreaterThanOrEqual(44);
    expect(deleteHitHeight).toBeGreaterThanOrEqual(44);
    expect(toggleHitHeight).toBeGreaterThanOrEqual(44);

    const photoFit = await image.evaluate((frame) => {
      const renderedImage = Array.from(frame.querySelectorAll("img")).find(
        (candidate) =>
          candidate.getAttribute("aria-hidden") !== "true" &&
          candidate.naturalWidth > 0 &&
          candidate.naturalHeight > 0,
      );

      if (!renderedImage) {
        return null;
      }

      const frameRect = frame.getBoundingClientRect();
      const imageRect = renderedImage.getBoundingClientRect();
      const scale = Math.min(
        imageRect.width / renderedImage.naturalWidth,
        imageRect.height / renderedImage.naturalHeight,
      );
      const paintedWidth = renderedImage.naturalWidth * scale;
      const paintedHeight = renderedImage.naturalHeight * scale;

      return {
        objectFit: getComputedStyle(renderedImage).objectFit,
        naturalAspect:
          renderedImage.naturalWidth / renderedImage.naturalHeight,
        frameAspect: frameRect.width / frameRect.height,
        horizontalEmpty: frameRect.width - paintedWidth,
        verticalEmpty: frameRect.height - paintedHeight,
      };
    });
    expect(photoFit).not.toBeNull();
    if (photoFit) {
      expect(photoFit.objectFit).toBe("contain");
      expect(photoFit.frameAspect).toBeCloseTo(photoFit.naturalAspect, 2);
      expect(photoFit.horizontalEmpty).toBeLessThanOrEqual(2);
      expect(photoFit.verticalEmpty).toBeLessThanOrEqual(2);
    }

    const checkedTrackColor = await sharingToggle.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await sharingToggle.click();
    await expect(sharingToggle).not.toBeChecked();
    await expect(page.getByTestId("cats-photo-delivery-state")).toHaveText(
      "送らない",
    );
    const uncheckedTrackColor = await sharingToggle.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(uncheckedTrackColor).not.toBe(checkedTrackColor);

    await testInfo.attach(`photo-detail-${viewport.width}x${viewport.height}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });
}

test("deletes a sleeping photo from its うちのこ detail", async ({ page }) => {
  const now = Date.parse("2026-07-23T20:30:00+09:00");
  const sleepingPhotoId = "own-sleeping-delete-detail";
  const userId = "cats-sleeping-delete-user";

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: "cats-sleeping-delete@example.test",
        app_metadata: {},
        user_metadata: {},
      }),
    });
  });
  await page.route("**/rest/v1/cat_moments**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: "[]",
    });
  });
  await seedCatsPhotoTabState(page, {
    now,
    sleepingPhotos: [
      {
        id: sleepingPhotoId,
        createdAt: Date.parse("2026-07-23T19:00:00+09:00"),
        shared: true,
      },
    ],
    galleryPhotos: [],
  });
  await page.addInitScript(
    ({ authUserId }) => {
      window.localStorage.setItem(
        "nyaruhodo_supabase_auth",
        JSON.stringify({
          access_token: "cats-sleeping-delete-token",
          refresh_token: "cats-sleeping-delete-refresh-token",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: authUserId,
            aud: "authenticated",
            role: "authenticated",
            email: "cats-sleeping-delete@example.test",
            app_metadata: {},
            user_metadata: {},
          },
        }),
      );
    },
    { authUserId: userId },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await page
    .getByTestId("cats-lens-photo-grid")
    .getByRole("button", { name: "7/23のむぎ" })
    .click();
  await page
    .getByTestId("cats-photo-viewer")
    .getByRole("button", { name: "この写真を削除" })
    .click();

  const deleteDialog = page.getByRole("dialog", {
    name: "この写真を削除",
  });
  await deleteDialog
    .getByRole("button", { name: "この写真を削除" })
    .click();

  await expect(page.getByTestId("cats-photo-viewer")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate((photoId) => {
        const photos = JSON.parse(
          window.localStorage.getItem(
            "nyaruhodo_exchange_own_sleeping_photos",
          ) ?? "[]",
        ) as { id?: string }[];

        return photos.some((photo) => photo.id === photoId);
      }, sleepingPhotoId),
    )
    .toBe(false);
});

test("does not offer a second household daily photo from another cat", async ({ page }) => {
  const now = Date.parse("2026-07-23T20:30:00+09:00");
  await seedCatsPhotoTabState(page, {
    now,
    sleepingPhotos: [],
    galleryPhotos: [],
  });
  await page.addInitScript(
    ({ nowValue, src }) => {
      const nowIso = new Date(nowValue).toISOString();
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "cat-mugi",
            name: "むぎ",
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: "cat-komugi",
            name: "こむぎ",
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "komugi-today",
            ownerCatId: "cat-komugi",
            catId: "cat-komugi",
            src,
            state: "sleeping",
            createdAt: nowValue - 60_000,
          },
        ]),
      );
    },
    { nowValue: now, src: photoDataUrl },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("cats-active-cat-name")).toHaveText("むぎ");
  await expect(page.getByTestId("cats-photo-today-card")).toHaveCount(0);
  await expect(page.getByTestId("cats-photo-today-link")).toHaveCount(0);
});

test("keeps photos outside the current month in the older photo section", async ({ page }) => {
  const now = Date.parse("2026-07-23T20:30:00+09:00");
  await seedCatsPhotoTabState(page, {
    now,
    sleepingPhotos: [
      {
        id: "own-sleeping-today",
        createdAt: Date.parse("2026-07-23T19:00:00+09:00"),
      },
      {
        id: "own-sleeping-previous-month",
        createdAt: Date.parse("2026-06-23T19:00:00+09:00"),
      },
      {
        id: "own-sleeping-two-months-ago",
        createdAt: Date.parse("2026-05-12T19:00:00+09:00"),
      },
    ],
    galleryPhotos: [],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("cats-photo-highlights")).toHaveAttribute("data-layout", "pair");
  await expect(page.getByTestId("cats-photo-today-card")).toHaveAttribute(
    "data-photo-id",
    "own-sleeping-today",
  );
  await expect(page.getByTestId("cats-photo-memory-card")).toHaveAttribute(
    "data-photo-id",
    "own-sleeping-previous-month",
  );
  await expect(page.getByTestId("cats-photo-memory-card")).toContainText("1か月前のむぎ");
  await expect(page.getByTestId("cats-photo-current-month")).toHaveText("7月のむぎ");
  await expect(page.getByTestId("cats-lens-photo-grid").locator(":scope > div")).toHaveCount(1);
  await expect(page.getByTestId("cats-photo-older")).toContainText("これまでの写真");
  await expect(page.getByTestId("cats-lens-photo-grid-older").locator(":scope > div")).toHaveCount(
    2,
  );
});

test("refreshes today and month grouping after returning on a new JST day", async ({ page }) => {
  const julyNow = Date.parse("2026-07-31T23:55:00+09:00");
  await seedCatsPhotoTabState(page, {
    now: julyNow,
    sleepingPhotos: [
      {
        id: "july-last-photo",
        createdAt: Date.parse("2026-07-31T20:00:00+09:00"),
      },
    ],
    galleryPhotos: [],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("cats-photo-today-card")).toHaveAttribute(
    "data-photo-id",
    "july-last-photo",
  );
  await page.evaluate(() => {
    (
      window as typeof window & {
        __testNow?: number;
      }
    ).__testNow = Date.parse("2026-08-01T08:00:00+09:00");
    window.dispatchEvent(new Event("focus"));
  });

  await expect(page.getByTestId("cats-photo-today-card")).toHaveCount(0);
  await expect(page.getByTestId("cats-photo-memory-card")).toHaveAttribute(
    "data-photo-id",
    "july-last-photo",
  );
  await expect(page.getByTestId("cats-photo-all-dates")).toHaveText(
    "むぎの写真",
  );
});

test("shows a useful empty state before the first daily photo", async ({ page }) => {
  await seedCatsPhotoTabState(page, {
    now: Date.parse("2026-07-23T12:30:00+09:00"),
    sleepingPhotos: [],
    galleryPhotos: [],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("cats-photo-highlights")).toHaveCount(0);
  await expect(page.getByTestId("cats-photo-today-link")).toContainText(
    "きょうの一枚を撮ると、ねこだよりが届きます",
  );
  await expect(page.getByTestId("cats-photo-all-dates")).toHaveText("むぎの写真");
  await expect(page.getByText("0枚", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "まだ写真はありません。ねがおを とるか、写真を追加すると、ここに並びます。",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "写真を追加" })).toBeVisible();
});

test("opens an unnamed cat album as この子 and keeps naming optional", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const createdAt = new Date("2026-07-23T12:30:00+09:00").toISOString();
    window.localStorage.setItem("active_cat_id", "cat-unnamed");
    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([
        {
          id: "cat-unnamed",
          name: "\u30df\u30b1",
          nameState: "unset",
          createdAt,
          updatedAt: createdAt,
        },
      ]),
    );
    window.sessionStorage.setItem(
      "neteruneko_onboarding_album_completion_ready",
      "true",
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats?onboarding=1");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("cats-active-cat-name")).toHaveText("この子");
  await expect(page.getByTestId("cats-section-tab-photos")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("cats-name-registration-button")).toHaveText(
    "名前を登録",
  );

  await page.getByTestId("cats-name-registration-button").click();
  let dialog = page.getByRole("dialog").first();
  await expect(dialog).toHaveAccessibleName("この子のことを 書く");
  await dialog.getByLabel("誕生日").fill("2022-07-11");
  await dialog.getByRole("button", { name: "保存する" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("cats-active-cat-name")).toHaveText("この子");
  await expect(page.getByTestId("cats-name-registration-button")).toHaveText(
    "名前を登録",
  );

  await page.getByTestId("cats-name-registration-button").click();
  dialog = page.getByRole("dialog").first();
  await dialog.getByLabel("この子の名前").fill("こはく");
  await dialog.getByRole("button", { name: "保存する" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("cats-active-cat-name")).toHaveText("こはく");
  await expect(page.getByTestId("cats-name-registration-button")).toHaveCount(0);
});

test("keeps a legacy cat actually named ミケ after the name-state upgrade", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const createdAt = new Date("2026-07-23T12:30:00+09:00").toISOString();
    window.localStorage.setItem("active_cat_id", "cat-legacy-mike");
    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([
        {
          id: "cat-legacy-mike",
          name: "\u30df\u30b1",
          createdAt,
          updatedAt: createdAt,
        },
      ]),
    );
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("cats-active-cat-name")).toHaveText(
    "\u30df\u30b1",
  );
  await expect(page.getByTestId("cats-name-registration-button")).toHaveCount(0);
});

test("links an onboarding four-choice save back to nekodayori", async ({ page }) => {
  const now = Date.parse("2026-07-23T12:30:00+09:00");
  const ownPhotoId = "onboarding-own-today";
  await seedCatsPhotoTabState(page, {
    now,
    sleepingPhotos: [{ id: ownPhotoId, createdAt: now - 60_000 }],
    galleryPhotos: [],
  });
  await page.addInitScript(
    ({ nowValue, ownId, src }) => {
      const deliveredPhotos = Array.from({ length: 4 }, (_, index) => ({
        id: `onboarding-delivered-${index + 1}`,
        src,
        deliveredAt: nowValue + index,
      }));
      window.localStorage.setItem(
        "neteruneko_onboarding_progress",
        JSON.stringify({
          version: 1,
          anonymousId: "onboarding-bridge-test",
          dateKey: "2026-07-23",
          stage: "album_created",
          source: "direct",
          submissionId: "onboarding-bridge-submission",
          ownPhoto: {
            id: ownId,
            ownerCatId: "cat-mugi",
            catId: "cat-mugi",
            src,
            createdAt: nowValue - 60_000,
          },
          deliveredPhoto: deliveredPhotos[2],
          deliveredPhotos,
          deliveryBundleId: "onboarding-bridge-bundle",
          isDeliveredPhotoKept: true,
          updatedAt: nowValue,
        }),
      );
    },
    { nowValue: now, ownId: ownPhotoId, src: photoDataUrl },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  const bridge = page.getByTestId("cats-photo-delivery-bridge");
  await expect(bridge).toContainText(
    "この写真を残した日に届いたねこだより",
  );
  await expect(
    bridge.getByRole("link", { name: "ねこだよりを見る" }),
  ).toHaveAttribute("href", "/collection");
});

test("reflects an added cat gallery photo immediately", async ({ page }) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 0);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "neteruneko_cat_gallery_intro_acknowledged",
      "true",
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-photos").click();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId("cats-add-photo-button").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "cat-gallery-upload.png",
    mimeType: "image/png",
    buffer: photoUploadBuffer,
  });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("neteruneko_cat_gallery_photos");
        const photos = raw ? JSON.parse(raw) : [];
        return {
          count: Array.isArray(photos) ? photos.length : 0,
          src: Array.isArray(photos) ? photos[0]?.src ?? "" : "",
        };
      }),
    )
    .toMatchObject({
      count: 1,
      src: expect.stringMatching(/^(data:image\/|storage:|storage:\/\/)/),
    });

  const grid = page.getByTestId("cats-lens-photo-grid");
  await expect(grid).toHaveAttribute("data-photo-decode-gate", "ready");
  await expect(grid.locator(":scope > div")).toHaveCount(1);
  await expect(grid.locator("img")).toHaveCount(1);
});

test("shows the photo lens switch only when multiple cats are registered", async ({
  page,
}) => {
  await seedMultipleCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-photos").click();

  await expect(page.getByTestId("cats-photo-lens-filter")).toBeVisible();
  await expect(page.getByTestId("cats-photo-lens-cat")).toHaveText("この子");
  await expect(page.getByTestId("cats-photo-lens-all")).toHaveText("ぜんぶ");
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

test("keeps cat switching in the shared header on every profile tab", async ({ page }) => {
  await seedMultipleCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");

  const switchButton = page.getByRole("button", {
    name: "次のねこに切り替える",
  });

  await expect(page.getByTestId("cats-profile-cover")).toHaveCount(0);
  await expect(switchButton).toBeVisible();

  await page.getByTestId("cats-section-tab-record").click();
  await expect(page.getByTestId("cats-profile-cover")).toHaveCount(0);
  await expect(switchButton).toBeVisible();
  await switchButton.click();

  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("active_cat_id")))
    .toBe("cat-komugi");

  await page.getByTestId("cats-section-tab-basic").click();
  await expect(page.getByTestId("cats-profile-cover")).toHaveCount(0);
  await expect(switchButton).toBeVisible();
  await expect(page.getByTestId("cats-cover-photo-button")).toHaveCount(0);
  await expect(page.getByTestId("cats-representative-photo")).toHaveCount(0);
  await expect(page.getByTestId("cats-profile-summary-card")).toContainText(
    "こむぎ",
  );
  await expect(page.getByTestId("cats-profile-summary-card")).toContainText(
    "女の子",
  );
  await expect(page.getByText("家族と共有", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "猫を追加・管理" })).toBeVisible();
});

test("keeps stored representative photo data without showing an unused setting", async ({
  page,
}) => {
  await seedCatsProfileWithCustomStorageCover(
    page,
    Date.parse("2026-06-10T12:30:00+09:00"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-basic").click();

  await expect(page.getByTestId("cats-profile-cover")).toHaveCount(0);
  await expect(page.getByTestId("cats-cover-photo-button")).toHaveCount(0);
  await expect(page.getByTestId("cats-representative-photo")).toHaveCount(0);
  await expect(page.getByTestId("cats-profile-summary-card")).toBeVisible();
  await expect(page.getByRole("button", { name: "猫を追加・管理" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("cat_profiles");
        const [profile] = raw ? JSON.parse(raw) : [];
        return {
          coverPhotoDataUrl: profile?.coverPhotoDataUrl ?? null,
          coverCrop: profile?.coverCrop ?? null,
        };
      }),
    )
    .toEqual({
      coverPhotoDataUrl: "storage:cat-mugi/cover/cover.webp",
      coverCrop: { scale: 1, offsetX: 0, offsetY: 0 },
    });

  await page.reload();
  await page.getByTestId("cats-section-tab-basic").click();
  await expect(page.getByTestId("cats-cover-photo-button")).toHaveCount(0);
});

test("shows every populated profile group without hiding saved information", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-07-25T12:00:00+09:00"));
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
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-basic").click();

  const summary = page.getByTestId("cats-profile-summary-card");
  await expect(summary).toContainText("むぎ");
  await expect(summary).toContainText("いっしょに暮らして");
  await expect(summary).toContainText("男の子・4歳");
  await expect(page.getByTestId("cats-profile-summary-photo")).toBeVisible();
  await expect(
    page.getByTestId("cats-profile-summary-photo").locator("img"),
  ).toHaveCount(1);
  await expect
    .poll(() =>
      summary.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    )
    .toBe(true);
  const editButtonBox = await page
    .getByTestId("cats-basic-info-edit-button")
    .boundingBox();
  expect(editButtonBox?.width).toBeGreaterThanOrEqual(44);
  expect(editButtonBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText("家族と共有", { exact: true })).toHaveCount(0);
  await expect(page.getByText("基本情報", { exact: true })).toBeVisible();
  await expect(page.getByText("2022年9月22日")).toBeVisible();
  await expect(page.getByText("2022年7月10日")).toBeVisible();
  await expect(page.getByText("この子らしさ")).toBeVisible();
  await expect(page.getByText("たいせつな日", { exact: true })).toHaveCount(0);
  await expect(page.getByText("見た目", { exact: true })).toHaveCount(0);
  await expect(page.getByText("その他のプロフィール", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("毛柄")).toBeVisible();
  await expect(page.getByText("ケア", { exact: true })).toHaveCount(0);
  await expect(page.getByText("かかりつけ")).toHaveCount(0);
  await expect(page.getByText("ワクチンを打った日")).toHaveCount(0);
  await expect(page.getByText("未登録")).toHaveCount(0);
  await expect(page.getByText("なでられると好きなところ")).toBeVisible();
  await expect(page.getByText("あごの下")).toBeVisible();
  await expect(page.getByText("7月10日は「むぎの日」")).toHaveCount(0);

  await page.getByTestId("cats-basic-info-edit-button").click();
  const editor = page.getByRole("dialog").first();
  await expect(
    editor.getByText("その他のプロフィールを編集", { exact: true }),
  ).toHaveCount(0);
  await expect(editor.getByLabel("毛柄")).toBeVisible();
  await editor.getByLabel("誕生日").fill("2022-07-11");
  await editor.getByRole("button", { name: "保存する" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const [profile] = JSON.parse(
          window.localStorage.getItem("cat_profiles") ?? "[]",
        );
        return {
          birthDate: profile?.basicInfo?.birthDate,
          favoriteTouch: profile?.basicInfo?.personality?.favoriteTouch,
          coat: profile?.appearance?.coat,
        };
      }),
    )
    .toEqual({
      birthDate: "2022-07-11",
      favoriteTouch: "あごの下",
      coat: "orange_tabby",
    });
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

  await page.getByRole("button", { name: "プロフィールを編集" }).click();
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
  await expect(
    dialog.getByText("その他のプロフィールを編集", { exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("radio", { name: "男の子" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "女の子" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "わからない" })).toBeVisible();
  await expect(dialog.getByLabel("猫種")).toHaveValue("ミックス");
  await expect(dialog.getByRole("button", { name: "保存する" })).toBeInViewport();

  await dialog.getByLabel("毛柄").fill("茶トラ");
  await dialog.getByLabel("体重（kg）").fill("21");
  await dialog.getByRole("button", { name: "保存する" }).click();
  await expect(
    dialog.getByText("体重は0.5〜20kgの範囲で入力してください。"),
  ).toBeVisible();
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

test("closes the basic profile editor instead of returning to cat management", async ({
  page,
}) => {
  await seedCatsBasicProfile(page, {
    basicInfo: {
      familySinceDate: "2022-09-22",
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-basic").click();

  await page.getByTestId("cats-basic-info-edit-button").click();
  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "もどる" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("うちのこを管理")).toHaveCount(0);
});

test("prioritizes a birthday and carries its losing milestone into the next day", async ({
  page,
}) => {
  const birthday = Date.parse("2026-07-10T12:30:00+09:00");
  const tomorrow = Date.parse("2026-07-11T12:30:00+09:00");
  await seedCatsProfile(page, birthday, 10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-record").click();

  const pickup = page.getByTestId("cats-pickup-section");
  await expect(pickup).toBeVisible();
  await expect(pickup).toContainText("今日の1件");
  await expect(pickup).toContainText("誕生日");
  await expect(page.getByText("思い出が")).toHaveCount(0);

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("neteruneko_cat_pickup_history") ?? "",
      ),
    )
    .toContain("birthday-2026");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("neteruneko_cat_pickup_history") ?? "",
      ),
    )
    .not.toContain("milestone-10");

  await page.addInitScript((nextNow) => {
    (window as typeof window & { __testNow?: number }).__testNow = nextNow;
  }, tomorrow);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-record").click();

  await expect(pickup).toContainText("10枚目のねがお");
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
  await page.getByTestId("cats-section-tab-record").click();

  await expect(page.getByRole("heading", { name: "足あと" })).toBeVisible();
  await expect(page.getByText("2026年6月")).toBeVisible();
  await expect(page.getByText("ねがおを とった").first()).toBeVisible();
  await expect(page.getByText("撮った")).toHaveCount(0);
  await expect(page.getByText("届いた")).toHaveCount(0);
});

test("shows celebrations as current milestones instead of a fixed 50-photo card", async ({
  page,
}) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-record").click();

  const celebration = page
    .getByRole("heading", { name: "記念" })
    .locator("xpath=ancestor::section");

  await expect(celebration).toContainText("家族になって");
  await expect(celebration).toContainText("ねがお");
  await expect(celebration).toContainText("10 / 50枚");
  await expect(celebration).toContainText("誕生日");
});

test("clears the first sleeping photo memory dot after opening it", async ({
  page,
}) => {
  const now = Date.parse("2026-07-14T21:30:00+09:00");
  await seedCatsProfile(page, now, 1);
  await page.addInitScript(
    ({ nowValue, src }) => {
      const photo = {
        id: "own-sleeping-0",
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
        createdAt: nowValue - 7 * 86_400_000,
      };

      if (
        window.sessionStorage.getItem("e2e_first_seed_memory_seeded") !== "true"
      ) {
        window.localStorage.setItem(
          "neteruneko_omoide_memories",
          JSON.stringify({
            "omoide-first-seed": {
              id: "omoide-first-seed",
              catId: "cat-mugi",
              catName: "\u3080\u304e",
              sourcePhotoId: photo.id,
              sourceDateKey: "2026-07-07",
              deliveryDateKey: "2026-07-13",
              photo,
              lookback: "week",
              reason: "first_seed",
              title: "\u306f\u3058\u3081\u3066\u306e\u3001\u306d\u304c\u304a\u3002",
              subtitle: "\u306f\u3058\u3081\u3066\u306e \u306d\u304c\u304a \u304c \u5c4a\u304d\u307e\u3057\u305f\u3002",
              voice: "\u306f\u3058\u3081\u3066\u306e\u3001\u306d\u304c\u304a\u3002",
              bridge: "\u3042\u308c\u304b\u3089\u30017\u65e5\u3002",
              deliveredAt: nowValue - 86_400_000,
            },
          }),
        );
        window.sessionStorage.setItem("e2e_first_seed_memory_seeded", "true");
      }
    },
    { nowValue: now, src: photoDataUrl },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-record").click();

  await expect(page.getByText("はじめてのねがお").first()).toBeVisible();
  await expect(page.getByTestId("cats-nav-unopened-omoide-dot")).toBeVisible();

  await page.getByTestId("cats-pickup-section").locator("button").click();
  await expect(page.getByTestId("omoide-memory-viewer")).toBeVisible();
  await expect(page.getByTestId("cats-nav-unopened-omoide-dot")).toHaveCount(0);

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("cats-nav-unopened-omoide-dot")).toHaveCount(0);
});

test("keeps the record tab sections in the intended order", async ({ page }) => {
  await seedCatsProfileWithOpenedMemory(
    page,
    Date.parse("2026-06-10T12:30:00+09:00"),
    12,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-record").click();
  await expect(page.locator("#cats-milestones-heading")).toBeVisible();

  const sectionOrder = await page
    .locator(
      "#cats-milestones-heading, #cats-omoide-heading, #cats-recent-heading, #cats-archive-heading",
    )
    .evaluateAll((headings) => headings.map((heading) => heading.id));

  expect(sectionOrder).toEqual([
    "cats-milestones-heading",
    "cats-omoide-heading",
    "cats-recent-heading",
    "cats-archive-heading",
  ]);
});

test("opens an omoide as a full paper view without cropping the photo", async ({
  page,
}) => {
  await page.goto("about:blank");
  const portraitPhoto = await buildRasterPhotoDataUrl(page, 900, 1600);
  await seedCatsProfileWithOpenedMemory(
    page,
    Date.parse("2026-06-10T21:30:00+09:00"),
    12,
    portraitPhoto,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats#omoide");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("cats-section-tab-record")).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await page
    .getByTestId("omoide-bunbako")
    .getByRole("button", { name: /先週のねがお/ })
    .click();

  const viewer = page.getByTestId("omoide-memory-viewer");
  const frame = page.getByTestId("omoide-memory-photo-frame");
  const stowButton = page.getByTestId("omoide-memory-stow");
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("dialog")).toBeVisible();
  await expect(stowButton).toHaveText("思い出箱に もどる");
  await expect(stowButton).toBeFocused();
  await expect
    .poll(async () => {
      const box = await frame.boundingBox();
      return box ? box.width / box.height : 0;
    })
    .toBeCloseTo(900 / 1600, 2);

  const layout = await page.evaluate(() => {
    const viewerElement = document.querySelector<HTMLElement>(
      '[data-testid="omoide-memory-viewer"]',
    );
    const buttonElement = document.querySelector<HTMLElement>(
      '[data-testid="omoide-memory-stow"]',
    );
    const buttonRect = buttonElement?.getBoundingClientRect();
    return {
      backgroundImage: viewerElement
        ? getComputedStyle(viewerElement).backgroundImage
        : "",
      buttonHeight: buttonRect?.height ?? 0,
      buttonBottom: buttonRect?.bottom ?? Number.POSITIVE_INFINITY,
      viewportHeight: window.innerHeight,
    };
  });
  expect(layout.backgroundImage).not.toBe("none");
  expect(layout.buttonHeight).toBeGreaterThanOrEqual(54);
  expect(layout.buttonBottom).toBeLessThanOrEqual(layout.viewportHeight);

  await page.screenshot({
    path: "artifacts/omoide-viewer-redesign/android-portrait.png",
    fullPage: true,
  });
  await page.goBack();
  await expect(viewer).toHaveCount(0);
  await expect(page.getByTestId("omoide-bunbako")).toBeVisible();
});

test("opens a year summary dashboard from the yearly archive", async ({
  page,
}) => {
  await seedCatsProfile(page, Date.parse("2026-06-10T12:30:00+09:00"), 10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cats");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cats-section-tab-record").click();

  await page.getByRole("button", { name: /2026年/ }).click();

  const dialog = page.getByRole("dialog", { name: "2026年" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("ねがお");
  await expect(dialog).toContainText("思い出");
  await expect(dialog).toContainText("記念");
  await expect(dialog).toContainText("6月によく とりました");
  await expect(dialog).toContainText("10枚目");
});

async function seedCatsPhotoTabState(
  page: Page,
  {
    now,
    sleepingPhotos,
    galleryPhotos,
    src = photoDataUrl,
  }: {
    now: number;
    sleepingPhotos: Array<{
      id: string;
      createdAt: number;
      shared?: boolean;
    }>;
    galleryPhotos: Array<{ id: string; createdAt: number }>;
    src?: string;
  },
) {
  await page.addInitScript(
    ({ nowValue, sleeping, gallery, src }) => {
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
          sleeping.map((photo) => {
            const shared = photo.shared ?? false;

            return {
              ...photo,
              ownerCatId: "cat-mugi",
              catId: "cat-mugi",
              src,
              thumbnailSrc: src,
              displaySrc: src,
              state: "sleeping",
              visibility: shared ? "shared" : "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared,
            };
          }),
        ),
      );
      window.localStorage.setItem(
        "neteruneko_cat_gallery_photos",
        JSON.stringify(
          gallery.map((photo) => ({
            ...photo,
            catId: "cat-mugi",
            src,
          })),
        ),
      );
    },
    {
      nowValue: now,
      sleeping: sleepingPhotos,
      gallery: galleryPhotos,
      src,
    },
  );
}

async function seedCatsProfile(
  page: Page,
  now: number,
  photoCount: number,
  options: { preserveOnReload?: boolean } = {},
) {
  await page.addInitScript(
    ({ nowValue, src, count, preserveOnReload }) => {
      (window as typeof window & { __testNow?: number }).__testNow = nowValue;
      const seedMarker = "neteruneko_test_cats_profile_seeded";

      if (
        preserveOnReload &&
        window.sessionStorage.getItem(seedMarker) === "true"
      ) {
        return;
      }

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

      if (preserveOnReload) {
        window.sessionStorage.setItem(seedMarker, "true");
      }
    },
    {
      nowValue: now,
      src: photoDataUrl,
      count: photoCount,
      preserveOnReload: options.preserveOnReload ?? false,
    },
  );
}

async function seedCatsProfileWithOpenedMemory(
  page: Page,
  now: number,
  photoCount: number,
  memoryPhotoSrc = photoDataUrl,
) {
  await seedCatsProfile(page, now, photoCount);
  await page.addInitScript(
    ({ nowValue, src }) => {
      const memoryPhoto = {
        id: "own-sleeping-memory",
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
        createdAt: nowValue - 7 * 86_400_000,
      };

      window.localStorage.setItem(
        "neteruneko_omoide_memories",
        JSON.stringify({
          "omoide-record-opened": {
            id: "omoide-record-opened",
            catId: "cat-mugi",
            catName: "\u3080\u304e",
            sourcePhotoId: memoryPhoto.id,
            sourceDateKey: "2026-06-03",
            deliveryDateKey: "2026-06-10",
            photo: memoryPhoto,
            lookback: "week",
            reason: "same_day",
            title: "\u5148\u9031\u306e\u306d\u304c\u304a",
            subtitle: "\u524d\u306b\u3068\u3063\u305f\u306d\u304c\u304a\u304c\u5c4a\u304d\u307e\u3057\u305f\u3002",
            voice: "\u3042\u306e\u65e5\u306e\u3080\u304e",
            bridge: "\u305d\u3063\u3068\u601d\u3044\u51fa\u3057\u307e\u3059\u3002",
            deliveredAt: nowValue,
            openedAt: nowValue,
          },
        }),
      );
    },
    { nowValue: now, src: memoryPhotoSrc },
  );
}

async function buildRasterPhotoDataUrl(
  page: Page,
  width: number,
  height: number,
) {
  return page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas_context_unavailable");
      context.fillStyle = "#b97963";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#ead7ba";
      context.beginPath();
      context.ellipse(
        width * 0.5,
        height * 0.48,
        width * 0.32,
        width * 0.23,
        -0.18,
        0,
        Math.PI * 2,
      );
      context.fill();
      return canvas.toDataURL("image/png");
    },
    { width, height },
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

async function seedCatsProfileWithCustomStorageCover(
  page: Page,
  now: number,
  options: { includeCrop?: boolean } = {},
) {
  await page.addInitScript(({ nowValue, includeCrop }) => {
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
          coverPhotoDataUrl: "storage:cat-mugi/cover/cover.webp",
          ...(includeCrop
            ? { coverCrop: { scale: 1, offsetX: 0, offsetY: 0 } }
            : {}),
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
  }, { nowValue: now, includeCrop: options.includeCrop ?? true });
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
