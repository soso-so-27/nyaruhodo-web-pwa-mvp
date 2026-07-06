import { expect, test, type Page } from "@playwright/test";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

test.describe("collection album flow", () => {
  test("shows only the active cat's taken sleeping photos when older photos belong to a previous cat id", async ({
    page,
  }) => {
    const now = Date.now();

    await page.addInitScript(
      ({ currentCatId, previousCatId, src, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
            {
              id: previousCatId,
              name: "previous cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
            {
              id: `own-sleeping-${createdAt - 1000}`,
              ownerCatId: previousCatId,
              catId: previousCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt: createdAt - 1000,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        previousCatId: "previous-cat",
        src: photoDataUrl,
        createdAt: now,
      },
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    const firstSentPhoto = page.getByTestId("mainichi-board-photo-sent").first();
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(1);
    await expect(firstSentPhoto).not.toHaveAttribute("data-mainichi-paste", "true");

    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(1);
  });

  test("shows restored storage sleeping photos alongside latest local photos", async ({
    page,
  }) => {
    const now = Date.now();

    await page.route("**/api/photo-storage/signed-urls", async (route) => {
      const body = route.request().postDataJSON() as {
        paths?: string[];
        variant?: string;
      };

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          signedUrls: Object.fromEntries(
            (body.paths ?? []).map((path) => [
              path,
              path === "user-1/current-cat/sleeping/restored.jpg" &&
              body.variant === "thumbnail"
                ? photoDataUrl
                : null,
            ]),
          ),
        }),
      });
    });

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      const body = route.request().postDataJSON() as { src?: string; variant?: string };

      if (
        body.src === "storage:user-1/current-cat/sleeping/restored.jpg" &&
        body.variant === "display"
      ) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: photoDataUrl }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null }),
      });
    });

    await page.addInitScript(
      ({ currentCatId, src, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
            {
              id: `own-sleeping-${createdAt - 1000}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src: "storage:user-1/current-cat/sleeping/restored.jpg",
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt: createdAt - 1000,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(2);
  });

  test("uses transformed display asset for sent board photos", async ({ page }) => {
    const now = Date.now();
    const displayPath = "user-1/current-cat/sleeping/display.jpg";
    const thumbnailPath = "user-1/current-cat/sleeping/thumbnail.webp";
    const signedUrlRequests: Array<{
      endpoint: "batch" | "single";
      paths: string[];
      variant?: string;
    }> = [];
    let releaseSingleSignedUrl: () => void = () => {};
    const singleSignedUrlGate = new Promise<void>((resolve) => {
      releaseSingleSignedUrl = resolve;
    });
    let shouldDelayDisplaySignedUrl = true;

    await page.route("**/api/photo-storage/signed-urls", async (route) => {
      const body = route.request().postDataJSON() as {
        paths?: string[];
        variant?: string;
      };
      signedUrlRequests.push({
        endpoint: "batch",
        paths: body.paths ?? [],
        variant: body.variant,
      });

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          signedUrls: Object.fromEntries(
            (body.paths ?? []).map((path) => [
              path,
              path === displayPath && body.variant !== "thumbnail"
                ? `/__signed-photo/${encodeURIComponent(path)}?variant=${body.variant ?? ""}`
                : null,
            ]),
          ),
        }),
      });
    });
    await page.route("**/api/photo-storage/signed-url", async (route) => {
      const body = route.request().postDataJSON() as {
        src?: string;
        variant?: string;
      };
      const path = body.src?.replace(/^storage:/, "") ?? "";
      signedUrlRequests.push({
        endpoint: "single",
        paths: path ? [path] : [],
        variant: body.variant,
      });
      if (
        shouldDelayDisplaySignedUrl &&
        path === displayPath &&
        body.variant === "thumbnail"
      ) {
        shouldDelayDisplaySignedUrl = false;
        await singleSignedUrlGate;
      }

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          signedUrl:
            path === displayPath || path === thumbnailPath
              ? `/__signed-photo/${encodeURIComponent(path)}?variant=${body.variant ?? ""}`
              : null,
        }),
      });
    });
    await page.route("**/__signed-photo/**", async (route) => {
      await route.fulfill({
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#886"/></svg>`,
      });
    });

    await page.addInitScript(
      ({ currentCatId, displaySrc, thumbnailSrc, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src: displaySrc,
              displaySrc,
              thumbnailSrc,
              originalSrc: displaySrc,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        displaySrc: `storage:${displayPath}`,
        thumbnailSrc: `storage:${thumbnailPath}`,
        createdAt: now,
      },
    );

    await page.goto("/collection", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(0, {
      timeout: 250,
    });
    releaseSingleSignedUrl();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(1);
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveAttribute(
      "data-photo-decode-ready",
      "true",
    );
    await expect(page.getByTestId("mainichi-board-photo-sent").locator("img").last()).toHaveJSProperty(
      "complete",
      true,
    );
    await expect
      .poll(() =>
        page
          .getByTestId("mainichi-board-photo-sent")
          .locator("img")
          .last()
          .evaluate((image) => window.getComputedStyle(image).opacity),
      )
      .toBe("1");
    const finalSrc = await page
      .getByTestId("mainichi-board-photo-sent")
      .locator("img")
      .last()
      .evaluate((image) => (image as HTMLImageElement).currentSrc);

    expect(
      signedUrlRequests.some(
        (request) =>
          request.paths.includes(displayPath) &&
          request.variant === "thumbnail",
      ),
    ).toBe(true);
    expect(decodeURIComponent(finalSrc)).toContain(displayPath);
    expect(finalSrc).toContain("variant=thumbnail");
  });

  test("prefetches startup photo URLs and image bodies soon after startup", async ({ page }) => {
    const now = Date.now();
    const currentCatId = "current-cat";
    const sentPath = "user-1/current-cat/sleeping/startup-sent-display.jpg";
    const deliveredPath = "delivery-archive/startup-delivered-display.jpg";
    const galleryPath = "cat-gallery/current-cat/startup-gallery-thumbnail.webp";
    const signedUrlRequests: Array<{ paths: string[]; variant?: string }> = [];
    const fetchedPhotoPaths: string[] = [];

    await page.addInitScript(
      ({ currentCatId, sentSrc, deliveredSrc, gallerySrc, createdAt }) => {
        window.requestIdleCallback = (callback: IdleRequestCallback) => {
          window.setTimeout(
            () =>
              callback({
                didTimeout: false,
                timeRemaining: () => 50,
              } as IdleDeadline),
            0,
          );
          return 1;
        };
        window.cancelIdleCallback = () => undefined;
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src: sentSrc,
              displaySrc: sentSrc,
              originalSrc: sentSrc,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_kept_photos",
          JSON.stringify([
            {
              id: "kept-startup",
              sourcePhotoId: "source-startup",
              src: deliveredSrc,
              displaySrc: deliveredSrc,
              originalSrc: deliveredSrc,
              title: "delivered",
              subtitle: "",
              triggerLabel: "mainichi",
              theme: "mainichi",
              deliveredAt: createdAt,
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_cat_gallery_photos",
          JSON.stringify([
            {
              id: "gallery-startup",
              catId: currentCatId,
              src: gallerySrc,
              thumbnailSrc: gallerySrc,
              createdAt,
            },
          ]),
        );
      },
      {
        currentCatId,
        sentSrc: `storage:${sentPath}`,
        deliveredSrc: `storage:${deliveredPath}`,
        gallerySrc: `storage:${galleryPath}`,
        createdAt: now,
      },
    );
    await page.route("**/api/photo-storage/signed-urls", async (route) => {
      const body = route.request().postDataJSON() as {
        paths?: string[];
        variant?: string;
      };
      signedUrlRequests.push({
        paths: body.paths ?? [],
        variant: body.variant,
      });

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          signedUrls: Object.fromEntries(
            (body.paths ?? []).map((path) => [
              path,
              `/__prefetched-photo/${encodeURIComponent(path)}?variant=${body.variant ?? ""}`,
            ]),
          ),
        }),
      });
    });
    await page.route("**/__prefetched-photo/**", async (route) => {
      const url = new URL(route.request().url());
      fetchedPhotoPaths.push(decodeURIComponent(url.pathname));
      await route.fulfill({
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#668"/></svg>`,
      });
    });

    await page.goto("/home");

    await expect
      .poll(() => signedUrlRequests.flatMap((request) => request.paths), {
        timeout: 5000,
      })
      .toEqual(expect.arrayContaining([sentPath, deliveredPath, galleryPath]));
    await expect
      .poll(() => fetchedPhotoPaths.join("\n"), { timeout: 5000 })
      .toContain(sentPath);
    expect(fetchedPhotoPaths.join("\n")).toContain(deliveredPath);
    expect(fetchedPhotoPaths.join("\n")).toContain(galleryPath);
    const prefetchEvent = await page.evaluate(() => {
      const events = JSON.parse(
        window.localStorage.getItem("analytics_event_queue") ?? "[]",
      ) as Array<{ name?: string; properties?: Record<string, unknown> }>;
      return events.find((event) => event.name === "photo_prefetch_done");
    });

    expect(prefetchEvent?.properties?.duration_ms).toEqual(expect.any(Number));
  });

  test("does not request a new signed url for the same storage photo in one session", async ({
    page,
  }) => {
    const now = Date.now();
    const storagePath = "user-1/current-cat/sleeping/cached.jpg";
    const storageSrc = `storage:${storagePath}`;
    let batchSignedUrlCalls = 0;
    let singleSignedUrlCalls = 0;

    await page.route("**/api/photo-storage/signed-urls", async (route) => {
      batchSignedUrlCalls += 1;
      const body = route.request().postDataJSON() as {
        paths?: string[];
        variant?: string;
      };
      expect(body.variant).toBe("thumbnail");
      const signedUrls = Object.fromEntries(
        (body.paths ?? []).map((path) => [path, path === storagePath ? photoDataUrl : null]),
      );

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ signedUrls }),
      });
    });

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      singleSignedUrlCalls += 1;
      const body = route.request().postDataJSON() as { src?: string; variant?: string };

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          signedUrl: body.src === storageSrc && body.variant === "display" ? photoDataUrl : null,
        }),
      });
    });

    await page.addInitScript(
      ({ currentCatId, src, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              thumbnailSrc: src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: storageSrc,
        createdAt: now,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(1);
    const callsAfterFirstView = batchSignedUrlCalls + singleSignedUrlCalls;
    const thumbnailBatchCallsAfterFirstView = batchSignedUrlCalls;
    expect(callsAfterFirstView).toBeGreaterThan(0);

    await page.locator('a[href="/cats"]').click();
    await page.waitForURL("**/cats");
    await page.locator('a[href="/collection"]').click();
    await page.waitForURL("**/collection");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(1);

    expect(batchSignedUrlCalls).toBe(thumbnailBatchCallsAfterFirstView);
  });

  test("falls back to plain signed url when thumbnail transform is unavailable", async ({
    page,
  }) => {
    const now = Date.now();
    const storagePath = "user-1/current-cat/sleeping/transform-fallback.jpg";
    const storageSrc = `storage:${storagePath}`;
    let batchSignedUrlCalls = 0;
    let plainSignedUrlCalls = 0;

    await page.route("**/api/photo-storage/signed-urls", async (route) => {
      batchSignedUrlCalls += 1;
      const body = route.request().postDataJSON() as {
        paths?: string[];
        variant?: string;
      };

      expect(body.variant).toBe("thumbnail");

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          signedUrls: Object.fromEntries(
            (body.paths ?? []).map((path) => [
              path,
              path === storagePath ? "data:image/png;base64,not-a-valid-image" : null,
            ]),
          ),
        }),
      });
    });

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      const body = route.request().postDataJSON() as { src?: string; variant?: string };
      if (body.src === storageSrc && body.variant === "display") {
        plainSignedUrlCalls += 1;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: photoDataUrl }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null }),
      });
    });

    await page.addInitScript(
      ({ currentCatId, src, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              thumbnailSrc: src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: storageSrc,
        createdAt: now,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(1);
    await page.getByTestId("mainichi-board-photo-sent").first().scrollIntoViewIfNeeded();

    await expect
      .poll(async () => plainSignedUrlCalls)
      .toBeGreaterThan(0);
    expect(batchSignedUrlCalls).toBeGreaterThan(0);

    expect(plainSignedUrlCalls).toBe(1);
  });

  test("writes delivered storage photos back as data urls for offline album display", async ({
    page,
  }) => {
    const now = Date.parse("2026-06-10T12:10:00.000Z");
    let allowSignedUrl = true;
    await page.clock.setFixedTime(new Date(now));

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      const body = route.request().postDataJSON() as { src?: string };

      if (
        allowSignedUrl &&
        body.src === "storage:admin-stock/sleeping/offline-delivered.jpg"
      ) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: photoDataUrl }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null }),
      });
    });

    await page.addInitScript(
      ({ currentCatId, src, createdAt }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow = createdAt;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        if (window.localStorage.getItem("offline_writeback_seeded") === "1") {
          return;
        }

        window.localStorage.setItem("offline_writeback_seeded", "1");
        const dateKey = new Date(createdAt).toISOString().slice(0, 10);
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt,
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_kept_photos",
          JSON.stringify([
            {
              id: "delivered-storage-offline",
              sourcePhotoId: "stock-offline",
              src: "storage:admin-stock/sleeping/offline-delivered.jpg",
              title: "とどいたねがお",
              subtitle: "",
              triggerLabel: "sleeping",
              theme: "sleeping",
              deliveredAt: createdAt,
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [dateKey]: {
              dateKey,
              targetOwnPhotoId: `own-sleeping-${createdAt}`,
              targetCatId: currentCatId,
              targetCapturedAt: createdAt,
              deliveredPhoto: {
                id: "delivered-storage-offline",
                sourcePhotoId: "stock-offline",
                src: "storage:admin-stock/sleeping/offline-delivered.jpg",
                title: "とどいたねがお",
                subtitle: "",
                triggerLabel: "sleeping",
                theme: "sleeping",
                deliveredAt: createdAt,
              },
              deliveredAt: createdAt,
              openedAt: createdAt + 1,
              keptAt: createdAt + 2,
            },
          }),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "とどいた" }).click();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const photos = JSON.parse(
            window.localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]",
          ) as { src?: string }[];
          return photos[0]?.src ?? "";
        }),
      )
      .toMatch(/^data:image\//);

    allowSignedUrl = false;
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "とどいた" }).click();

    await expect(page.locator('main img[src^="data:image/"]')).toHaveCount(1);
  });

  test("prefers delivered storage refs over stale signed display urls", async ({
    page,
  }) => {
    const now = Date.parse("2026-06-15T11:20:00.000Z");
    const dateKey = "2026-06-15";
    const storageSrc = "storage:admin-stock/sleeping/delivered-2026-06-15.jpg";
    const staleSignedSrc =
      "https://example.invalid/storage/v1/object/sign/cat-photos/admin-stock/sleeping/delivered-2026-06-15.jpg?token=expired";
    const signedUrlRequests: string[] = [];
    await page.clock.setFixedTime(new Date(now));

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      const body = route.request().postDataJSON() as { src?: string };
      signedUrlRequests.push(body.src ?? "");

      if (body.src === storageSrc) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: photoDataUrl }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null }),
      });
    });

    await page.addInitScript(
      ({ currentCatId, ownSrc, deliveredSrc, staleSrc, createdAt, targetDateKey }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src: ownSrc,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt,
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [targetDateKey]: {
              dateKey: targetDateKey,
              targetOwnPhotoId: `own-sleeping-${createdAt}`,
              targetCatId: currentCatId,
              targetCapturedAt: createdAt,
              deliveredPhoto: {
                id: "delivered-stale-signed-url",
                sourcePhotoId: "stock-stale-signed-url",
                src: deliveredSrc,
                originalSrc: staleSrc,
                title: "縺ｨ縺ｩ縺・◆縺ｭ縺後♀",
                subtitle: "",
                triggerLabel: "sleeping",
                theme: "sleeping",
                deliveredAt: createdAt + 1,
              },
              deliveredAt: createdAt + 1,
              openedAt: createdAt + 2,
            },
          }),
        );
      },
      {
        currentCatId: "current-cat",
        ownSrc: photoDataUrl,
        deliveredSrc: storageSrc,
        staleSrc: staleSignedSrc,
        createdAt: now,
        targetDateKey: dateKey,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "とどいた" }).click();

    await expect(page.getByTestId("mainichi-board-photo-delivered")).toBeVisible();
    await expect.poll(() => signedUrlRequests).toContain(storageSrc);
    expect(signedUrlRequests).not.toContain(staleSignedSrc);
  });

  test("keeps unopened evening deliveries as a sealed envelope until opened", async ({
    page,
  }) => {
    const now = Date.parse("2026-06-10T11:05:00.000Z");
    const dateKey = "2026-06-10";

    await seedCollectionEveningDelivery(page, {
      now,
      dateKey,
      opened: false,
    });

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("mainichi-photo-board")).toBeVisible();
    await expect(page.getByTestId("album-sealed-delivery")).toHaveCount(0);
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(0);
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(1);

    await seedCollectionEveningDelivery(page, {
      now,
      dateKey,
      opened: true,
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("album-sealed-delivery")).toHaveCount(0);
    await page.getByRole("tab", { name: "とどいた" }).click();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toBeVisible();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(1);
  });

  test("auto-opens yesterday's unopened evening delivery after 5am", async ({
    page,
  }) => {
    const now = Date.parse("2026-06-10T20:01:00.000Z");
    await seedCollectionEveningDelivery(page, {
      now,
      deliveredAt: Date.parse("2026-06-10T11:05:00.000Z"),
      dateKey: "2026-06-10",
      opened: false,
    });

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("album-sealed-delivery")).toHaveCount(0);
    await page.getByRole("tab", { name: "とどいた" }).click();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toBeVisible();
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const store = JSON.parse(
            window.localStorage.getItem("neteruneko_evening_delivery_days") ??
              "{}",
          ) as Record<string, { openedAt?: number; openedBy?: string }>;
          const day = store["2026-06-10"];
          return Boolean(day?.openedAt) && day?.openedBy === "system";
        }),
      )
      .toBe(true);
  });

  test("shows legacy storage-url sleeping photos alongside latest local photos", async ({
    page,
  }) => {
    const now = Date.now();

    await page.route("**/api/photo-storage/signed-url", async (route) => {
      const body = route.request().postDataJSON() as { src?: string };

      if (
        body.src === "storage://user-1/current-cat/sleeping/restored.jpg" ||
        body.src === "storage:user-1/current-cat/sleeping/restored.jpg"
      ) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: photoDataUrl }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null }),
      });
    });

    await page.addInitScript(
      ({ currentCatId, src, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt,
            },
            {
              id: `own-sleeping-${createdAt - 1000}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src: "storage://user-1/current-cat/sleeping/restored.jpg",
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: false,
              createdAt: createdAt - 1000,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(2);
  });

  test("hides the other slot before the first evening delivery target day", async ({
    page,
  }) => {
    const now = Date.parse("2026-06-10T10:00:00.000Z");
    const todayKey = "2026-06-10";
    const yesterdayAt = now - 24 * 60 * 60 * 1000;
    await page.clock.setFixedTime(new Date(now));

    await page.addInitScript(
      ({ currentCatId, src, createdAt, olderCreatedAt, targetDateKey }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow =
          createdAt;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "ミケ",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [targetDateKey]: {
              dateKey: targetDateKey,
              targetOwnPhotoId: "own-sleeping-today",
              targetCatId: currentCatId,
              targetCapturedAt: createdAt,
            },
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "own-sleeping-today",
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt,
            },
            {
              id: "own-sleeping-yesterday",
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt: olderCreatedAt,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
        olderCreatedAt: yesterdayAt,
        targetDateKey: todayKey,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(0);
    await expect(page.getByText("この日の ねがおは ありません")).toHaveCount(0);
    await expect(page.getByTestId("album-daily-missing-letter")).toHaveCount(0);
  });

  test("renders daily entries as a month board without missing slots", async ({
    page,
  }) => {
    const now = Date.parse("2026-06-10T12:00:00.000Z");
    const todayKey = "2026-06-10";
    await page.clock.setFixedTime(new Date(now));

    await page.addInitScript(
      ({ currentCatId, src, createdAt, targetDateKey }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow =
          createdAt;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "むぎ",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [targetDateKey]: {
              dateKey: targetDateKey,
              targetOwnPhotoId: "own-sleeping-today",
              targetCatId: currentCatId,
              targetCapturedAt: createdAt,
            },
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "own-sleeping-today",
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              thumbnailSrc: src,
              state: "sleeping",
              visibility: "private",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
        targetDateKey: todayKey,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("mainichi-photo-board")).toBeVisible();
    await expect(page.getByTestId("mainichi-month-board")).toBeVisible();
    const sentPhoto = page.getByTestId("mainichi-board-photo-sent");
    await expect(sentPhoto).toBeVisible();
    await expect(sentPhoto).toHaveAttribute("data-mainichi-paste", "true");
    await expect(page.getByTestId("album-daily-letter-card")).toHaveCount(0);
    await expect(page.getByTestId("album-daily-missing-letter")).toHaveCount(0);
    await expect(page.getByText("ほかのねがお")).toHaveCount(0);
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(1);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("mainichi-board-photo-sent")).toBeVisible();
    await expect(page.getByTestId("mainichi-board-photo-sent")).not.toHaveAttribute(
      "data-mainichi-paste",
      "true",
    );
  });

  test("opens a delivered mainichi photo directly and hides it from fullscreen", async ({
    page,
  }) => {
    const now = Date.parse("2026-06-13T11:05:00.000Z");
    const dateKey = "2026-06-13";
    await page.clock.setFixedTime(new Date(now));

    await page.addInitScript(
      ({ currentCatId, src, createdAt, targetDateKey }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: `own-sleeping-${createdAt}`,
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "shared",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt,
            },
          ]),
        );
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [targetDateKey]: {
              dateKey: targetDateKey,
              targetOwnPhotoId: `own-sleeping-${createdAt}`,
              targetCatId: currentCatId,
              targetCapturedAt: createdAt,
              deliveredPhoto: {
                id: "delivered-mainichi-day",
                sourcePhotoId: "stock-mainichi-day",
                src,
                title: "とどいたねがお",
                subtitle: "",
                triggerLabel: "sleeping",
                theme: "sleeping",
                deliveredAt: createdAt + 1,
              },
              deliveredAt: createdAt + 1,
              openedAt: createdAt + 2,
            },
          }),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
        targetDateKey: dateKey,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "とどいた" }).click();
    await page.getByTestId("mainichi-board-photo-delivered").click();
    await expect(page.getByTestId("mainichi-photo-viewer")).toBeVisible();
    await disableNextDevToolsPointerEvents(page);
    await page.getByRole("button", { name: "ねこだよりから外す" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "外す" })
      .click();
    await expect(page.getByTestId("mainichi-photo-viewer")).toHaveCount(0);
    await expect(page.getByTestId("mainichi-board-photo-delivered")).toHaveCount(0);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const photos = JSON.parse(
            window.localStorage.getItem("nyaruhodo_exchange_dismissed_photos") ?? "[]",
          ) as { id?: string; sourcePhotoId?: string }[];

          return photos.some(
            (photo) =>
              photo.id === "delivered-mainichi-day" ||
              photo.sourcePhotoId === "stock-mainichi-day",
          );
        }),
      )
      .toBe(true);
  });

  test("opens an own mainichi photo directly and updates its delivery actions", async ({
    page,
  }) => {
    const now = Date.parse("2026-06-14T11:05:00.000Z");
    await page.clock.setFixedTime(new Date(now));

    await page.addInitScript(
      ({ currentCatId, src, createdAt }) => {
        window.localStorage.setItem("active_cat_id", currentCatId);
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: currentCatId,
              name: "current cat",
              createdAt: new Date(createdAt).toISOString(),
              updatedAt: new Date(createdAt).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "own-mainichi-action",
              ownerCatId: currentCatId,
              catId: currentCatId,
              src,
              state: "sleeping",
              visibility: "shared",
              deliveryStatus: "available",
              triggerLabel: "sleeping",
              theme: "sleeping",
              shared: true,
              createdAt,
            },
          ]),
        );
      },
      {
        currentCatId: "current-cat",
        src: photoDataUrl,
        createdAt: now,
      },
    );

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("mainichi-board-photo-sent").click();
    await expect(page.getByTestId("mainichi-photo-viewer")).toBeVisible();

    await page.getByRole("button", { name: "自分だけにする" }).click();
    await expect(page.getByRole("button", { name: "ねこだよりに使う" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const photos = JSON.parse(
            window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
              "[]",
          ) as { id?: string; shared?: boolean; visibility?: string }[];
          const photo = photos.find((candidate) => candidate.id === "own-mainichi-action");

          return photo?.shared === false && photo.visibility === "private";
        }),
      )
      .toBe(true);

    await page.getByRole("button", { name: "削除" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "削除" }).click();
    await expect(page.getByTestId("mainichi-photo-viewer")).toHaveCount(0);
    await expect(page.getByTestId("mainichi-board-photo-sent")).toHaveCount(0);
  });
});

async function seedCollectionEveningDelivery(
  page: Page,
  {
    now,
    deliveredAt = now,
    dateKey,
    opened,
  }: {
    now: number;
    deliveredAt?: number;
    dateKey: string;
    opened: boolean;
  },
) {
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(
    ({ currentCatId, src, currentNow, deliveredAt, targetDateKey, opened }) => {
      const originalDateNow = Date.now.bind(Date);
      (window as typeof window & { __testNow?: number }).__testNow = currentNow;
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();

      window.localStorage.setItem("active_cat_id", currentCatId);
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: currentCatId,
            name: "current cat",
            createdAt: new Date(deliveredAt).toISOString(),
            updatedAt: new Date(deliveredAt).toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "own-sleeping-today",
            ownerCatId: currentCatId,
            catId: currentCatId,
            src,
            state: "sleeping",
            visibility: "private",
            deliveryStatus: "available",
            triggerLabel: "sleeping",
            theme: "sleeping",
            shared: true,
            createdAt: deliveredAt,
          },
        ]),
      );
      window.localStorage.setItem("nyaruhodo_exchange_kept_photos", "[]");
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify({
          [targetDateKey]: {
            dateKey: targetDateKey,
            targetOwnPhotoId: "own-sleeping-today",
            targetCatId: currentCatId,
            targetCapturedAt: deliveredAt,
            deliveredPhoto: {
              id: "delivered-unopened-test",
              sourcePhotoId: "stock-unopened-test",
              src,
              title: "",
              subtitle: "",
              triggerLabel: "sleeping",
              theme: "sleeping",
              deliveredAt,
            },
            deliveredAt,
            ...(opened ? { openedAt: deliveredAt + 1 } : {}),
          },
        }),
      );
    },
    {
      currentCatId: "current-cat",
      src: photoDataUrl,
      currentNow: now,
      deliveredAt,
      targetDateKey: dateKey,
      opened,
    },
  );
}

async function disableNextDevToolsPointerEvents(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { pointer-events: none !important; }",
  });
}
