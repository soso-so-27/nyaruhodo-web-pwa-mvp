import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Proposed four-choice UI/API contract used by this specification:
 *
 * - `evening-four-choice`: the four-candidate selection dialog.
 * - `evening-four-choice-option`: one candidate button with `data-photo-id`.
 * - `evening-four-choice-save`: saves the currently selected candidate.
 * - `evening-four-choice-close`: closes while preserving the bundle and draft.
 * - `evening-four-choice-skip`: explicitly resolves without saving a photo.
 * - Exchange response: `experienceVersion: "evening_choice_v1"`, `bundleId`,
 *   `photos`, plus the legacy-compatible `photo` field.
 *
 * The onboarding instant delivery is intentionally outside this specification;
 * it remains a single-photo experience.
 */

const DATE_KEY = "2026-07-22";
const AFTER_DELIVERY = Date.parse("2026-07-22T11:05:00.000Z");
const AFTER_SELECTION_EXPIRY = Date.parse("2026-07-22T20:05:00.000Z");
const CAPTURED_AT = Date.parse("2026-07-22T09:30:00.000Z");
const BUNDLE_ID = `evening-bundle-${DATE_KEY}-e2e`;
const OWN_PHOTO_ID = "four-choice-own-photo";
const CAT_ID = "four-choice-cat";
const PHOTO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";
const fourCandidates = Array.from({ length: 4 }, (_, index) => ({
  id: `four-choice-delivery-${index + 1}`,
  sourcePhotoId: `four-choice-source-${index + 1}`,
  src: PHOTO_DATA_URL,
  title: "ほかの猫のねがお",
  subtitle: "",
  triggerLabel: "sleeping",
  theme: "sleeping",
  deliveredAt: AFTER_DELIVERY + index,
}));

test.describe("20時便の4匹選択", () => {
  test("4匹から選んだ1匹だけを保存し、再読込後も選択結果を保つ", async ({
    page,
  }) => {
    await seedPendingEveningDelivery(page, "save-and-reload");
    const readExchangeCalls = await mockFourChoiceExchange(page);

    await page.goto("/home");
    await expect.poll(readExchangeCalls).toBe(1);
    await page.getByTestId("desk-open-letter").click();

    const choiceDialog = page.getByTestId("evening-four-choice");
    const choices = choiceDialog.getByTestId("evening-four-choice-option");
    await expect(choiceDialog).toBeVisible();
    await expect(choices).toHaveCount(4);
    await expect.poll(() => readChoicePhotoIds(choices)).toEqual([
      "four-choice-delivery-1",
      "four-choice-delivery-2",
      "four-choice-delivery-3",
      "four-choice-delivery-4",
    ]);
    await expect.poll(() => readKeptPhotoIds(page)).toEqual([]);
    if (process.env.CAPTURE_FOUR_CHOICE === "1") {
      await page.screenshot({
        path: "artifacts/evening-four-choice.png",
        fullPage: true,
      });
    }
    const selectedPhotoId = "four-choice-delivery-3";
    await choiceDialog
      .locator(
        `[data-testid="evening-four-choice-option"][data-photo-id="${selectedPhotoId}"]`,
      )
      .click();
    await choiceDialog.getByTestId("evening-four-choice-save").click();

    await expect.poll(() => readEveningSelection(page)).toEqual({
      keptPhotoIds: [selectedPhotoId],
      selectedPhotoId,
      hasKeptAt: true,
    });

    await page.reload();
    await expect.poll(() => readEveningSelection(page)).toEqual({
      keptPhotoIds: [selectedPhotoId],
      selectedPhotoId,
      hasKeptAt: true,
    });
    await expect(page.getByTestId("evening-four-choice")).toHaveCount(0);
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
  });

  test("閉じても同じ4匹と仮選択を保ち、封筒から再開できる", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await seedPendingEveningDelivery(page, "close-and-reopen");
    const readExchangeCalls = await mockFourChoiceExchange(page);

    await page.goto("/home");
    await expect.poll(readExchangeCalls).toBe(1);
    await page.getByTestId("desk-open-letter").click();

    const choiceDialog = page.getByTestId("evening-four-choice");
    await expect(choiceDialog.getByTestId("evening-four-choice-option")).toHaveCount(4);
    await expect(choiceDialog.getByText("あとでえらぶ")).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await choiceDialog
        .getByTestId("evening-four-choice-skip")
        .evaluate((element) => element.getBoundingClientRect().bottom <= window.innerHeight),
    ).toBe(true);
    const draftPhotoId = "four-choice-delivery-2";
    await choiceDialog
      .locator(
        `[data-testid="evening-four-choice-option"][data-photo-id="${draftPhotoId}"]`,
      )
      .click();
    expect(
      await choiceDialog
        .getByTestId("evening-four-choice-save")
        .evaluate((element) => element.getBoundingClientRect().bottom <= window.innerHeight),
    ).toBe(true);
    expect(
      await choiceDialog
        .getByTestId("evening-four-choice-skip")
        .evaluate((element) => element.getBoundingClientRect().bottom <= window.innerHeight),
    ).toBe(true);
    await choiceDialog.getByTestId("evening-four-choice-close").click();

    await expect(choiceDialog).toHaveCount(0);
    await expect.poll(() => readEveningSelection(page)).toEqual({
      keptPhotoIds: [],
      selectedPhotoId: null,
      hasKeptAt: false,
    });
    await expect.poll(() => readEveningDraftSelection(page)).toBe(draftPhotoId);
    await expect(page.getByTestId("desk-open-letter")).toBeVisible();

    await page.getByTestId("desk-open-letter").click();
    const reopenedDialog = page.getByTestId("evening-four-choice");
    await expect(reopenedDialog).toBeVisible();
    await expect(reopenedDialog.getByTestId("evening-four-choice-option")).toHaveCount(4);
    await expect
      .poll(() =>
        readChoicePhotoIds(
          reopenedDialog.getByTestId("evening-four-choice-option"),
        ),
      )
      .toEqual([
        "four-choice-delivery-1",
        "four-choice-delivery-2",
        "four-choice-delivery-3",
        "four-choice-delivery-4",
      ]);
    await expect(
      reopenedDialog.locator(
        `[data-testid="evening-four-choice-option"][data-photo-id="${draftPhotoId}"]`,
      ),
    ).toHaveAttribute("aria-checked", "true");
    await expect(reopenedDialog.getByTestId("evening-four-choice-save")).toBeEnabled();
    await expect(reopenedDialog.getByText("あとでえらぶ")).toHaveCount(0);
    expect(readExchangeCalls()).toBe(1);
  });

  test("明示的に保存しないを選ぶと、4匹を残さず今夜分を終了する", async ({
    page,
  }) => {
    await seedPendingEveningDelivery(page, "skip-without-saving");
    const readExchangeCalls = await mockFourChoiceExchange(page);

    await page.goto("/home");
    await expect.poll(readExchangeCalls).toBe(1);
    await page.getByTestId("desk-open-letter").click();

    const choiceDialog = page.getByTestId("evening-four-choice");
    await expect(choiceDialog).toBeVisible();
    await choiceDialog
      .locator(
        '[data-testid="evening-four-choice-option"][data-photo-id="four-choice-delivery-4"]',
      )
      .click();
    await choiceDialog.getByTestId("evening-four-choice-skip").click();

    await expect(choiceDialog).toHaveCount(0);
    await expect.poll(() => readSkippedEveningDelivery(page)).toEqual({
      hasArrival: false,
      hasDraftSelection: false,
      hasSkippedAt: true,
    });
    await expect.poll(() => readKeptPhotoIds(page)).toEqual([]);
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);
    await expect(page.getByTestId("home-letter-tray")).toHaveAttribute(
      "data-phase",
      "empty-after",
    );
    await expect(page.getByText("また、あした")).toBeVisible();
    await expect(page.getByText("きょうは とどかない")).toHaveCount(0);
  });

  test("期限後に戻っても古い4匹を取得せず、その日の便を終了する", async ({
    page,
  }) => {
    await seedPendingEveningDelivery(
      page,
      "expired-before-fetch",
      AFTER_SELECTION_EXPIRY,
    );
    const readExchangeCalls = await mockFourChoiceExchange(page);

    await page.goto("/home");

    await expect.poll(() => readSkippedEveningDelivery(page)).toEqual({
      hasArrival: false,
      hasDraftSelection: false,
      hasSkippedAt: true,
    });
    expect(readExchangeCalls()).toBe(0);
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);
  });

  test("報告した候補は保存せず選択不可にし、別の1匹だけを残せる", async ({
    page,
  }) => {
    await seedPendingEveningDelivery(page, "report-and-save-another");
    const readExchangeCalls = await mockFourChoiceExchange(page);
    const reportedRequests: Array<Record<string, unknown>> = [];
    await page.route("**/api/reports", async (route) => {
      reportedRequests.push(
        route.request().postDataJSON() as Record<string, unknown>,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/home");
    await expect.poll(readExchangeCalls).toBe(1);
    await page.getByTestId("desk-open-letter").click();

    const choiceDialog = page.getByTestId("evening-four-choice");
    const reportedPhotoId = "four-choice-delivery-2";
    const reportedChoice = choiceDialog.locator(
      `[data-testid="evening-four-choice-option"][data-photo-id="${reportedPhotoId}"]`,
    );
    await reportedChoice.click();
    await choiceDialog.getByTestId("evening-four-choice-report").click();
    await page.getByRole("button", { name: "ねこの写真ではない" }).click();

    await expect(reportedChoice).toBeDisabled();
    await expect(reportedChoice).toContainText("報告済み");
    await expect(
      choiceDialog.getByTestId("evening-four-choice-save"),
    ).toBeDisabled();
    await expect.poll(() => readKeptPhotoIds(page)).toEqual([]);
    await expect
      .poll(() => readReportedPhotoIds(page))
      .toContain(reportedPhotoId);
    await expect.poll(() => reportedRequests.length).toBe(1);
    expect(reportedRequests[0]).toMatchObject({
      photoId: reportedPhotoId,
      sourcePhotoId: "four-choice-source-2",
      reason: "not_cat",
    });

    const keptPhotoId = "four-choice-delivery-4";
    await choiceDialog
      .locator(
        `[data-testid="evening-four-choice-option"][data-photo-id="${keptPhotoId}"]`,
      )
      .click();
    await choiceDialog.getByTestId("evening-four-choice-save").click();

    await expect.poll(() => readEveningSelection(page)).toEqual({
      keptPhotoIds: [keptPhotoId],
      selectedPhotoId: keptPhotoId,
      hasKeptAt: true,
    });
    await expect
      .poll(() => readKeptPhotoIds(page))
      .not.toContain(reportedPhotoId);
  });

  test("旧singleレスポンスは開封時に従来どおり1匹を自動保存する", async ({
    page,
  }) => {
    await seedPendingEveningDelivery(page, "legacy-single");
    const singlePhoto = {
      ...fourCandidates[0]!,
      id: "legacy-single-delivery",
      sourcePhotoId: "legacy-single-source",
    };
    let exchangeCalls = 0;
    await page.route("**/api/sleeping-delivery/exchange", async (route) => {
      exchangeCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          photo: singlePhoto,
          source: "remote",
          tier: 1,
        }),
      });
    });

    await page.goto("/home");
    await expect.poll(() => exchangeCalls).toBe(1);
    await page.getByTestId("desk-open-letter").click();

    await expect(page.getByTestId("evening-opening-pair")).toBeVisible();
    await expect(page.getByTestId("evening-four-choice")).toHaveCount(0);
    await expect.poll(() => readEveningSelection(page)).toEqual({
      keptPhotoIds: [singlePhoto.id],
      selectedPhotoId: null,
      hasKeptAt: true,
    });
  });
});

async function mockFourChoiceExchange(page: Page) {
  let exchangeCalls = 0;

  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    exchangeCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photo: fourCandidates[0],
        photos: fourCandidates,
        source: "remote",
        tier: 1,
        bundleId: BUNDLE_ID,
        experienceVersion: "evening_choice_v1",
        assignedVariant: "four_choice_v1",
        servedVariant: "four_choice_v1",
        requestedCount: 4,
        servedCount: 4,
        requestedCandidateCount: 4,
        returnedCandidateCount: 4,
      }),
    });
  });

  return () => exchangeCalls;
}

async function seedPendingEveningDelivery(
  page: Page,
  seedName: string,
  now = AFTER_DELIVERY,
) {
  await page.addInitScript(
    ({
      afterDelivery,
      capturedAt,
      catId,
      dateKey,
      ownPhotoId,
      photoDataUrl,
      seedMarker,
    }) => {
      const originalDateNow = Date.now.bind(Date);
      Date.now = () => afterDelivery ?? originalDateNow();

      if (window.localStorage.getItem(seedMarker) === "1") {
        return;
      }

      window.localStorage.setItem(seedMarker, "1");
      window.localStorage.setItem("neteruneko_onboarding_completed", "true");
      window.localStorage.setItem("nyaruhodo_sleeping_safety_accepted", "1");
      window.localStorage.setItem("active_cat_id", catId);
      window.localStorage.setItem(
        "cat_profiles",
        JSON.stringify([
          {
            id: catId,
            name: "4匹テスト猫",
            createdAt: new Date(capturedAt).toISOString(),
            updatedAt: new Date(capturedAt).toISOString(),
          },
        ]),
      );
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        JSON.stringify([
          {
            id: ownPhotoId,
            ownerCatId: catId,
            catId,
            src: photoDataUrl,
            state: "sleeping",
            visibility: "shared",
            deliveryStatus: "available",
            shared: true,
            triggerLabel: "sleeping",
            theme: "sleeping",
            createdAt: capturedAt,
            captureContext: "daily",
          },
        ]),
      );
      window.localStorage.setItem("nyaruhodo_exchange_kept_photos", "[]");
      window.localStorage.setItem(
        "neteruneko_evening_delivery_days",
        JSON.stringify({
          [dateKey]: {
            dateKey,
            targetOwnPhotoId: ownPhotoId,
            targetCatId: catId,
            targetCapturedAt: capturedAt,
          },
        }),
      );
    },
    {
      afterDelivery: now,
      capturedAt: CAPTURED_AT,
      catId: CAT_ID,
      dateKey: DATE_KEY,
      ownPhotoId: OWN_PHOTO_ID,
      photoDataUrl: PHOTO_DATA_URL,
      seedMarker: `neteruneko_e2e_four_choice_seeded_${seedName}`,
    },
  );
}

async function readKeptPhotoIds(page: Page) {
  return page.evaluate(() => {
    const parsed = JSON.parse(
      window.localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]",
    ) as Array<{ id?: string }>;
    return parsed.map((photo) => photo.id).filter((id): id is string => Boolean(id));
  });
}

async function readReportedPhotoIds(page: Page) {
  return page.evaluate(() => {
    const parsed = JSON.parse(
      window.localStorage.getItem("nyaruhodo_exchange_reported_photos") ?? "[]",
    ) as Array<{ photoId?: string; sourcePhotoId?: string }>;
    return parsed.flatMap((photo) =>
      [photo.photoId, photo.sourcePhotoId].filter(
        (id): id is string => Boolean(id),
      ),
    );
  });
}

async function readChoicePhotoIds(choices: Locator) {
  return choices.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-photo-id")),
  );
}

async function readEveningSelection(page: Page) {
  return page.evaluate((dateKey) => {
    const kept = JSON.parse(
      window.localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]",
    ) as Array<{ id?: string }>;
    const days = JSON.parse(
      window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
    ) as Record<
      string,
      {
        selectedPhotoId?: string;
        keptAt?: number;
      }
    >;
    const day = days[dateKey];

    return {
      keptPhotoIds: kept
        .map((photo) => photo.id)
        .filter((id): id is string => Boolean(id)),
      selectedPhotoId: day?.selectedPhotoId ?? null,
      hasKeptAt: typeof day?.keptAt === "number",
    };
  }, DATE_KEY);
}

async function readEveningDraftSelection(page: Page) {
  return page.evaluate((dateKey) => {
    const days = JSON.parse(
      window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
    ) as Record<string, { draftSelectedPhotoId?: string }>;
    return days[dateKey]?.draftSelectedPhotoId ?? null;
  }, DATE_KEY);
}

async function readSkippedEveningDelivery(page: Page) {
  return page.evaluate((dateKey) => {
    const days = JSON.parse(
      window.localStorage.getItem("neteruneko_evening_delivery_days") ?? "{}",
    ) as Record<
      string,
      {
        deliveredPhoto?: unknown;
        deliveredPhotos?: unknown[];
        draftSelectedPhotoId?: string;
        skippedAt?: number;
      }
    >;
    const day = days[dateKey];
    return {
      hasArrival: Boolean(day?.deliveredPhoto || day?.deliveredPhotos?.length),
      hasDraftSelection: Boolean(day?.draftSelectedPhotoId),
      hasSkippedAt: typeof day?.skippedAt === "number",
    };
  }, DATE_KEY);
}
