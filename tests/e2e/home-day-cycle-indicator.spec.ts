import { expect, test, type Page } from "@playwright/test";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

const currentJstDateKey = getCurrentJstDateKey();
const beforeEight = getCurrentJstTime(19, 30);
const wellBeforeEight = getCurrentJstTime(18, 0);
const afterEight = getCurrentJstTime(20, 10);

test.describe("home desk state cycle", () => {
  test("maps home states to day-cycle indicator classes", async ({ page }) => {
    await seedHomeState(page, { now: beforeEight });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );

    await seedHomeState(page, {
      now: wellBeforeEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
      },
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "2",
    );

    await seedHomeState(page, {
      now: afterEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
        deliveredPhoto: buildDeliveredPhoto(),
        deliveredAt: beforeEight,
      },
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "3",
    );

    await seedHomeState(page, {
      now: afterEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
        deliveredPhoto: buildDeliveredPhoto(),
        deliveredAt: beforeEight,
        openedAt: beforeEight,
      },
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
  });

  test("opens delivery from the state 3 desk letter", async ({ page }) => {
    await seedHomeState(page, {
      now: afterEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
        deliveredPhoto: buildDeliveredPhoto(),
        deliveredAt: beforeEight,
      },
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    const openButton = page.getByTestId("desk-open-letter");
    await openButton.click();

    await expect(page.getByTestId("evening-opening-pair")).toBeVisible();
  });

  test("keeps the evening delivery state independent of the selected cat", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ nowValue, dateKey, src }) => {
        const originalDateNow = Date.now.bind(Date);
        (window as typeof window & { __testNow?: number }).__testNow = nowValue;
        Date.now = () =>
          (window as typeof window & { __testNow?: number }).__testNow ??
          originalDateNow();
        window.localStorage.clear();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("neteruneko_onboarding_completed", "true");
        window.localStorage.setItem("active_cat_id", "cat-other");
        window.localStorage.setItem(
          "cat_profiles",
          JSON.stringify([
            {
              id: "cat-home",
              name: "むぎ",
              createdAt: new Date(nowValue).toISOString(),
              updatedAt: new Date(nowValue).toISOString(),
            },
            {
              id: "cat-other",
              name: "そら",
              createdAt: new Date(nowValue).toISOString(),
              updatedAt: new Date(nowValue).toISOString(),
            },
          ]),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify([
            {
              id: "own-today",
              ownerCatId: "cat-home",
              catId: "cat-home",
              src,
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
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [dateKey]: {
              dateKey,
              targetOwnPhotoId: "own-today",
              targetCatId: "cat-home",
              targetCapturedAt: nowValue,
              deliveredPhoto: {
                id: "delivered-today",
                sourcePhotoId: "source-today",
                src,
                triggerLabel: "sleeping",
                theme: "sleeping",
                deliveredAt: nowValue,
              },
              deliveredAt: nowValue,
            },
          }),
        );
      },
      { nowValue: afterEight, dateKey: currentJstDateKey, src: photoDataUrl },
    );

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "3",
    );
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(1);
  });

  test("restores remote account photos after Google login on an empty PWA install", async ({
    page,
  }) => {
    const userId = "user-restore-empty-pwa";
    const remoteCatId = "remote-cat-restore";
    const localCatId = "local-cat-restored";
    const restoredPhotoUrl = `storage:${userId}/${remoteCatId}/sleeping/restored.jpg`;
    const restoredCoverPath = `${userId}/${remoteCatId}/cover/cover.webp`;
    const now = Date.parse("2026-07-07T09:00:00+09:00");

    await page.addInitScript(
      ({ accessToken, createdAt, userId }) => {
        window.localStorage.clear();
        window.localStorage.setItem(
          "auth_google_pending",
          JSON.stringify({
            provider: "google",
            route: "/account/create",
            method: "oauth_redirect",
            startedAt: new Date(createdAt).toISOString(),
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_supabase_auth",
          JSON.stringify({
            access_token: accessToken,
            refresh_token: "test-refresh-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: userId,
              aud: "authenticated",
              role: "authenticated",
              email: "restore@example.test",
              app_metadata: {},
              user_metadata: {},
            },
          }),
        );
      },
      {
        accessToken: "test-access-token",
        createdAt: now,
        userId,
      },
    );

    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "restore@example.test",
          app_metadata: {},
          user_metadata: {},
        }),
      });
    });
    await page.route("**/rest/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const table = url.pathname.split("/").pop() ?? "";
      const rowsByTable: Record<string, unknown[]> = {
        profiles: [],
        cats: [
          {
            id: remoteCatId,
            local_cat_id: localCatId,
            name: "復元ねこ",
            type_key: null,
            type_label: null,
            type_tagline: null,
            basic_info: {},
            appearance: {},
            axis_scores: {},
            activity_pattern: {},
            type_scores: {},
            modifiers: [],
            onboarding: {},
            understanding: {},
            avatar_storage_path: null,
            cover_storage_path: restoredCoverPath,
            cover_crop: { scale: 0.55, offsetX: 12, offsetY: -8 },
            home_photo_storage_path: null,
            home_photo_position: null,
            local_created_at: new Date(now).toISOString(),
            local_updated_at: new Date(now).toISOString(),
            created_at: new Date(now).toISOString(),
            updated_at: new Date(now).toISOString(),
          },
        ],
        record_logs: [],
        collection_photos: [],
        cat_moments: [
          {
            id: "remote-moment-restored",
            local_moment_id: "local-moment-restored",
            local_cat_id: localCatId,
            owner_cat_id: remoteCatId,
            photo_url: restoredPhotoUrl,
            state: "sleeping",
            visibility: "shared",
            delivery_status: "available",
            source_moment_id: null,
            metadata: {},
            captured_at: new Date(now).toISOString(),
            created_at: new Date(now).toISOString(),
          },
        ],
        cat_moment_deliveries: [],
        account_local_state: [],
        account_sync_state: [],
        product_analytics_events: [],
        app_events: [],
      };

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(rowsByTable[table] ?? []),
      });
    });

    await page.goto("/home?auth=google_success");

    await expect
      .poll(() =>
        page.evaluate(() => ({
          activeCatId: window.localStorage.getItem("active_cat_id"),
          profiles: JSON.parse(
            window.localStorage.getItem("cat_profiles") ?? "[]",
          ) as Array<{
            coverPhotoDataUrl?: string;
            coverCrop?: { scale?: number; offsetX?: number; offsetY?: number };
          }>,
          ownPhotos: JSON.parse(
            window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos") ??
              "[]",
          ) as Array<{ src?: string }>,
        })),
      )
      .toMatchObject({
        activeCatId: localCatId,
        profiles: [
          {
            coverPhotoDataUrl: `storage:${restoredCoverPath}`,
            coverCrop: { scale: 0.55, offsetX: 12, offsetY: -8 },
          },
        ],
        ownPhotos: [{ src: restoredPhotoUrl }],
      });
  });

  test("syncs all local sleeping history without applying home display limits", async ({
    page,
  }) => {
    const userId = "user-sync-full-history";
    const now = Date.parse("2026-07-08T09:00:00+09:00");
    const ownPhotos = Array.from({ length: 30 }, (_, index) => ({
      id: `own-history-${String(index + 1).padStart(2, "0")}`,
      ownerCatId: "cat-history",
      catId: "cat-history",
      src: `storage:${userId}/cat-history/sleeping/own-history-${index + 1}.jpg`,
      state: "sleeping",
      visibility: "shared",
      deliveryStatus: "available",
      triggerLabel: "sleeping",
      theme: "sleeping",
      shared: true,
      createdAt: now - index * 60_000,
      captureContext: "daily",
    }));
    const keptPhotos = Array.from({ length: 55 }, (_, index) => ({
      id: `kept-history-${String(index + 1).padStart(2, "0")}`,
      sourcePhotoId: `source-history-${index + 1}`,
      src: `storage:${userId}/kept/deliveries/kept-history-${index + 1}.jpg`,
      title: "delivered",
      subtitle: "",
      triggerLabel: "sleeping",
      theme: "sleeping",
      deliveredAt: now - index * 60_000,
    }));
    let insertedMoments: unknown[] = [];
    let insertedDeliveries: unknown[] = [];

    await page.addInitScript(
      ({ accessToken, keptPhotosValue, nowValue, ownPhotosValue, userIdValue }) => {
        window.localStorage.clear();
        window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
        window.localStorage.setItem("neteruneko_onboarding_completed", "true");
        window.localStorage.setItem("active_cat_id", "cat-history");
        window.localStorage.setItem(
          "auth_google_pending",
          JSON.stringify({
            provider: "google",
            route: "/account/create",
            method: "oauth_redirect",
            startedAt: new Date(nowValue).toISOString(),
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_supabase_auth",
          JSON.stringify({
            access_token: accessToken,
            refresh_token: "test-refresh-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: userIdValue,
              aud: "authenticated",
              role: "authenticated",
              email: "history@example.test",
              app_metadata: {},
              user_metadata: {},
            },
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_own_sleeping_photos",
          JSON.stringify(ownPhotosValue),
        );
        window.localStorage.setItem(
          "nyaruhodo_exchange_kept_photos",
          JSON.stringify(keptPhotosValue),
        );
      },
      {
        accessToken: "test-history-access-token",
        keptPhotosValue: keptPhotos,
        nowValue: now,
        ownPhotosValue: ownPhotos,
        userIdValue: userId,
      },
    );

    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "history@example.test",
          app_metadata: {},
          user_metadata: {},
        }),
      });
    });
    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const table = url.pathname.split("/").pop() ?? "";
      const method = request.method();

      if (method === "POST" && table === "cat_moments") {
        insertedMoments = JSON.parse(request.postData() ?? "[]") as unknown[];
      }

      if (method === "POST" && table === "cat_moment_deliveries") {
        insertedDeliveries = JSON.parse(request.postData() ?? "[]") as unknown[];
      }

      await route.fulfill({
        status: method === "GET" ? 200 : 201,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.goto("/home?auth=google_success");

    await expect
      .poll(() => ({
        deliveries: insertedDeliveries.length,
        moments: insertedMoments.length,
      }))
      .toEqual({
        deliveries: 55,
        moments: 30,
      });
  });

  test("restores all remote sleeping history without applying local display limits", async ({
    page,
  }) => {
    const userId = "user-restore-full-history";
    const remoteCatId = "remote-cat-full-history";
    const localCatId = "local-cat-full-history";
    const now = Date.parse("2026-07-08T09:00:00+09:00");
    const remoteMoments = Array.from({ length: 30 }, (_, index) => ({
      id: `remote-moment-${index + 1}`,
      local_moment_id: `local-moment-${index + 1}`,
      local_cat_id: localCatId,
      owner_cat_id: remoteCatId,
      photo_url: `storage:${userId}/${remoteCatId}/sleeping/local-moment-${index + 1}.jpg`,
      state: "sleeping",
      visibility: "shared",
      delivery_status: "available",
      source_moment_id: null,
      metadata: {},
      captured_at: new Date(now - index * 60_000).toISOString(),
      created_at: new Date(now - index * 60_000).toISOString(),
    }));
    const remoteDeliveries = Array.from({ length: 55 }, (_, index) => ({
      id: `remote-delivery-${index + 1}`,
      local_delivery_id: `local-delivery-${index + 1}`,
      source_moment_id: `source-moment-${index + 1}`,
      source_photo_id: `source-photo-${index + 1}`,
      recipient_local_cat_id: null,
      photo_url: `storage:${userId}/kept/deliveries/local-delivery-${index + 1}.jpg`,
      status: "kept",
      metadata: {},
      delivered_at: new Date(now - index * 60_000).toISOString(),
    }));

    await page.addInitScript(
      ({ accessToken, createdAt, userIdValue }) => {
        window.localStorage.clear();
        window.localStorage.setItem(
          "auth_google_pending",
          JSON.stringify({
            provider: "google",
            route: "/account/create",
            method: "oauth_redirect",
            startedAt: new Date(createdAt).toISOString(),
          }),
        );
        window.localStorage.setItem(
          "nyaruhodo_supabase_auth",
          JSON.stringify({
            access_token: accessToken,
            refresh_token: "test-refresh-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: userIdValue,
              aud: "authenticated",
              role: "authenticated",
              email: "restore-full@example.test",
              app_metadata: {},
              user_metadata: {},
            },
          }),
        );
      },
      {
        accessToken: "test-restore-full-access-token",
        createdAt: now,
        userIdValue: userId,
      },
    );

    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "restore-full@example.test",
          app_metadata: {},
          user_metadata: {},
        }),
      });
    });
    await page.route("**/rest/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const table = url.pathname.split("/").pop() ?? "";
      const rowsByTable: Record<string, unknown[]> = {
        profiles: [],
        cats: [
          {
            id: remoteCatId,
            local_cat_id: localCatId,
            name: "restored",
            type_key: null,
            type_label: null,
            type_tagline: null,
            basic_info: {},
            appearance: {},
            axis_scores: {},
            activity_pattern: {},
            type_scores: {},
            modifiers: [],
            onboarding: {},
            understanding: {},
            avatar_storage_path: null,
            cover_storage_path: null,
            cover_crop: null,
            home_photo_storage_path: null,
            home_photo_position: null,
            local_created_at: new Date(now).toISOString(),
            local_updated_at: new Date(now).toISOString(),
            created_at: new Date(now).toISOString(),
            updated_at: new Date(now).toISOString(),
          },
        ],
        record_logs: [],
        collection_photos: [],
        cat_moments: remoteMoments,
        cat_moment_deliveries: remoteDeliveries,
        account_local_state: [],
        account_sync_state: [],
        product_analytics_events: [],
        app_events: [],
      };

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(rowsByTable[table] ?? []),
      });
    });

    await page.goto("/home?auth=google_success");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const readArray = (key: string) => {
            try {
              const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");

              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          };

          return {
            keptCount: readArray("nyaruhodo_exchange_kept_photos").length,
            ownCount: readArray("nyaruhodo_exchange_own_sleeping_photos").length,
          };
        }),
      )
      .toEqual({
        keptCount: 55,
        ownCount: 30,
      });
  });

  test("omits motif animation classes when reduced motion is enabled", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedHomeState(page, {
      now: wellBeforeEight,
      eveningDay: {
        dateKey: currentJstDateKey,
        targetOwnPhotoId: "own-today",
        targetCatId: "cat-home",
        targetCapturedAt: beforeEight,
      },
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".day-cycle-dot-flow")).toHaveCount(0);
    await expect(page.locator(".day-cycle-camera-fill")).toHaveCount(0);
  });

  test("hides routine subcopy after ten exchanges but keeps the end-of-day copy", async ({
    page,
  }) => {
    await seedHomeState(page, {
      now: beforeEight,
      keptExchangePhotoCount: 10,
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );
    await expect(page.getByText("むぎ、ねてる?")).toHaveCount(0);

    await seedHomeState(page, {
      now: afterEight,
      keptExchangePhotoCount: 10,
    });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1b",
    );
    await expect(page.getByText("きょうは とどかない")).toBeVisible();
    await expect(page.getByText("また あした")).toBeVisible();
  });

  test("removes the home wordmark while keeping page identity elsewhere", async ({
    page,
  }) => {
    await seedHomeState(page, { now: beforeEight });
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("ねてるねこ", { exact: true })).toBeHidden();

    await page.goto("/collection");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("ねこだより", { exact: true }).first()).toBeVisible();

    await page.goto("/cats");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: "うちのこ" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "記録" })).toBeVisible();
  });

  test("hides the presence line even when the presence api returns a count", async ({
    page,
  }) => {
    await page.route("/api/presence", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 124 }),
      });
    });
    await seedHomeState(page, { now: beforeEight });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/きょうも、.*ねこが ねています/)).toHaveCount(0);
  });

  test("omits the presence line when the presence api returns null", async ({
    page,
  }) => {
    await page.route("/api/presence", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: null }),
      });
    });
    await seedHomeState(page, { now: beforeEight });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/きょうも、.*ねこが ねています/)).toHaveCount(0);
  });

  test("keeps the home usable when the presence fetch fails", async ({ page }) => {
    await page.route("/api/presence", async (route) => {
      await route.abort();
    });
    await seedHomeState(page, { now: beforeEight });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "1",
    );
    await expect(page.getByText(/きょうも、.*ねこが ねています/)).toHaveCount(0);
  });

  test("keeps the home frame usable on mobile viewports", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport);
      await seedHomeState(page, {
        now: wellBeforeEight,
        eveningDay: {
          dateKey: currentJstDateKey,
          targetOwnPhotoId: "own-today",
          targetCatId: "cat-home",
          targetCapturedAt: beforeEight,
        },
      });

      await page.goto("/home");
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
        "data-state",
        "2",
      );

      const frameBox = await page.getByTestId("desk-home-frame").boundingBox();
      expect(frameBox).not.toBeNull();
      expect(frameBox!.width).toBeLessThanOrEqual(viewport.width - 24);
      expect(frameBox!.height).toBeGreaterThan(220);
      await expect(page.getByTestId("desk-letter")).toHaveCount(0);
    }
  });
});

async function seedHomeState(
  page: Page,
  {
    now,
    eveningDay,
    keptExchangePhotoCount = 0,
  }: {
    now: number;
    eveningDay?: Record<string, unknown>;
    keptExchangePhotoCount?: number;
  },
) {
  await page.addInitScript(
    ({ nowValue, eveningDayValue, keptCount, src }) => {
      const originalDateNow = Date.now.bind(Date);
      (window as typeof window & { __testNow?: number }).__testNow = nowValue;
      Date.now = () =>
        (window as typeof window & { __testNow?: number }).__testNow ??
        originalDateNow();
      window.localStorage.clear();
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("neteruneko_onboarding_completed", "true");
      window.localStorage.setItem("active_cat_id", "cat-home");
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: "cat-home",
            name: "ミケ",
            nameConfirmedAt: new Date(nowValue).toISOString(),
            createdAt: new Date(nowValue).toISOString(),
            updatedAt: new Date(nowValue).toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: "own-today",
            ownerCatId: "cat-home",
            catId: "cat-home",
            src,
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
      if (eveningDayValue) {
        window.localStorage.setItem(
          "neteruneko_evening_delivery_days",
          JSON.stringify({
            [eveningDayValue.dateKey as string]: eveningDayValue,
          }),
        );
      }
      window.localStorage.setItem(
        "nyaruhodo_exchange_kept_photos",
        JSON.stringify(
          Array.from({ length: keptCount }, (_, index) => ({
            id: `kept-${index}`,
            src,
            triggerLabel: "sleeping",
            theme: "sleeping",
            deliveredAt: nowValue - index,
          })),
        ),
      );
    },
    {
      nowValue: now,
      eveningDayValue: eveningDay ?? null,
      keptCount: keptExchangePhotoCount,
      src: photoDataUrl,
    },
  );
}

function buildDeliveredPhoto() {
  return {
    id: "delivered-today",
    sourcePhotoId: "source-today",
    src: photoDataUrl,
    triggerLabel: "sleeping",
    theme: "sleeping",
    deliveredAt: beforeEight,
  };
}

function getCurrentJstDateKey() {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentJstTime(hour: number, minute: number) {
  const [year, month, day] = currentJstDateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day, hour - 9, minute);
}
