import { expect, test, type Locator, type Page } from "@playwright/test";

import { sendPhotoReport } from "../../src/lib/home/photoReports";

/**
 * Proposed four-choice UI/API contract used by this specification:
 *
 * - `evening-four-choice`: the four-candidate selection dialog.
 * - `evening-four-choice-option`: one candidate button with `data-photo-id`.
 * - `evening-four-choice-save`: saves the currently selected candidate.
 * - `evening-four-choice-close`: asks before leaving an unresolved choice.
 * - `evening-four-choice-exit-confirm`: the unresolved-choice confirmation.
 * - `evening-four-choice-exit-continue`: returns to the same four candidates.
 * - `evening-four-choice-exit-skip`: resolves the delivery without saving.
 * - `evening-four-choice-skip`: explicitly resolves without saving a photo.
 * - `evening-four-choice-own-record`: opens the own-cat record after saving.
 * - Exchange response: `experienceVersion: "evening_choice_v1"`, `bundleId`,
 *   `photos`, plus the legacy-compatible `photo` field.
 *
 * Onboarding has its own server-confirmed four-choice flow and is covered by
 * onboarding-delivery-flow.spec.ts.
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

test("photo report client requires an explicit JSON success response", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 });
    await expect(
      sendPhotoReport(fourCandidates[0]!, "other"),
    ).resolves.toBeUndefined();

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false }), { status: 200 });
    await expect(sendPhotoReport(fourCandidates[0]!, "other")).rejects.toThrow(
      "Photo report failed with 200",
    );

    globalThis.fetch = async () => new Response("not-json", { status: 200 });
    await expect(sendPhotoReport(fourCandidates[0]!, "other")).rejects.toThrow(
      "Photo report failed with 200",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test.describe("20時便の4枚選択", () => {
  test("4枚から選んだ1枚だけを保存し、再読込後も選択結果を保つ", async ({
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
    await page.evaluate(() => document.fonts.ready);
    const typography = await choiceDialog.evaluate((dialog) => {
      const elements = {
        title: dialog.querySelector<HTMLElement>("#evening-four-choice-title"),
        lead: dialog.querySelector<HTMLElement>(
          '[data-testid="evening-four-choice-lead"]',
        ),
        save: dialog.querySelector<HTMLElement>(
          '[data-testid="evening-four-choice-save"]',
        ),
        skip: dialog.querySelector<HTMLElement>(
          '[data-testid="evening-four-choice-skip"]',
        ),
      };
      const lineCount = (element: HTMLElement) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return new Set(
          Array.from(range.getClientRects())
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => Math.round(rect.top * 2) / 2),
        ).size;
      };
      const bodyFamily = window.getComputedStyle(document.body).fontFamily;
      const primaryFamily = bodyFamily
        .split(",")[0]
        .trim()
        .replace(/^["']|["']$/g, "");
      const loadedUiFaces = Array.from(document.fonts)
        .filter(
          (face) =>
            face.family.replace(/^["']|["']$/g, "") === primaryFamily,
        )
        .map((face) => ({ status: face.status, weight: face.weight }));
      return {
        bodyFamily,
        loadedUiFaces,
        fontChecks: {
          normal: document.fonts.check(
            `400 13px "${primaryFamily}"`,
            elements.lead?.textContent ?? "",
          ),
          medium: document.fonts.check(
            `500 14px "${primaryFamily}"`,
            elements.save?.textContent ?? "",
          ),
        },
        entries: Object.fromEntries(
          Object.entries(elements).map(([key, element]) => {
            if (!element) {
              throw new Error(`Missing typography target: ${key}`);
            }
            const computed = window.getComputedStyle(element);
            return [
              key,
              {
                fontFamily: computed.fontFamily,
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                lineCount: lineCount(element),
                overflows: element.scrollWidth > element.clientWidth,
              },
            ];
          }),
        ),
      };
    });
    expect(
      Object.values(typography.entries).map((entry) => entry.fontFamily),
    ).toEqual([
      typography.bodyFamily,
      typography.bodyFamily,
      typography.bodyFamily,
      typography.bodyFamily,
    ]);
    expect(typography.loadedUiFaces).toEqual(
      expect.arrayContaining([
        { status: "loaded", weight: "400" },
        { status: "loaded", weight: "500" },
      ]),
    );
    expect(typography.fontChecks).toEqual({ normal: true, medium: true });
    expect(typography.entries).toMatchObject({
      title: { fontSize: "22px", fontWeight: "500", lineCount: 1, overflows: false },
      lead: { fontSize: "13px", fontWeight: "400", lineCount: 1, overflows: false },
      save: { fontSize: "14px", fontWeight: "500", lineCount: 1, overflows: false },
      skip: { fontSize: "12px", fontWeight: "400", lineCount: 1, overflows: false },
    });
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
    await expect(
      choiceDialog.getByTestId("evening-four-choice-saved"),
    ).toBeVisible();
    await expect(
      choiceDialog.getByTestId("evening-four-choice-own-record"),
    ).toHaveText("きょう撮った写真を「うちのこ」で見る›");
    await choiceDialog.getByTestId("evening-four-choice-finish").click();

    await expect(choiceDialog).toHaveCount(0);
    await expect(page.getByTestId("home-desk-model")).toHaveAttribute(
      "data-state",
      "4",
    );
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);

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
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);
  });

  test("保存後にきょう撮ったうちの猫へ移動できる", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await seedPendingEveningDelivery(page, "open-own-record");
    await mockFourChoiceExchange(page);

    await page.goto("/home");
    await page.getByTestId("desk-open-letter").click();
    const choiceDialog = page.getByTestId("evening-four-choice");
    await choiceDialog
      .locator(
        '[data-testid="evening-four-choice-option"][data-photo-id="four-choice-delivery-1"]',
      )
      .click();
    await choiceDialog.getByTestId("evening-four-choice-save").click();
    const ownRecordLink = choiceDialog.getByTestId(
      "evening-four-choice-own-record",
    );
    await expect(ownRecordLink).toBeVisible();
    const ownRecordLinkBox = await ownRecordLink.boundingBox();
    expect(ownRecordLinkBox).not.toBeNull();
    expect(ownRecordLinkBox!.x).toBeGreaterThanOrEqual(0);
    expect(ownRecordLinkBox!.x + ownRecordLinkBox!.width).toBeLessThanOrEqual(
      320,
    );
    await ownRecordLink.click();

    await expect(page).toHaveURL(/\/cats$/);
    await expect(page.getByTestId("cats-page")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => window.localStorage.getItem("active_cat_id")),
      )
      .toBe(CAT_ID);
  });

  test("閉じる前に確認し、選択に戻るか今回分を保存せず終了できる", async ({
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

    const exitConfirm = page.getByTestId("evening-four-choice-exit-confirm");
    await expect(exitConfirm).toBeVisible();
    await exitConfirm.getByTestId("evening-four-choice-exit-continue").click();

    await expect(exitConfirm).toHaveCount(0);
    await expect(choiceDialog).toBeVisible();
    await expect(
      choiceDialog.locator(
        `[data-testid="evening-four-choice-option"][data-photo-id="${draftPhotoId}"]`,
      ),
    ).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => readEveningSelection(page)).toEqual({
      keptPhotoIds: [],
      selectedPhotoId: null,
      hasKeptAt: false,
    });
    await expect.poll(() => readEveningDraftSelection(page)).toBe(draftPhotoId);

    await page.goBack();
    await expect(exitConfirm).toBeVisible();
    await exitConfirm.getByTestId("evening-four-choice-exit-skip").click();

    await expect(choiceDialog).toHaveCount(0);
    await expect.poll(() => readSkippedEveningDelivery(page)).toEqual({
      hasArrival: false,
      hasDraftSelection: false,
      hasSkippedAt: true,
    });
    await expect.poll(() => readKeptPhotoIds(page)).toEqual([]);
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);
    expect(readExchangeCalls()).toBe(1);
  });

  test("明示的に保存しないを選ぶと、4枚を残さず今夜分を終了する", async ({
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
    await expect(page.getByTestId("home-letter-tray")).toContainText(
      "保存すると、次のよる8時ごろにねこだよりがとどきます",
    );
    await expect(page.getByText("きょうは とどかない")).toHaveCount(0);
  });

  test("期限後に戻っても古い4枚を取得せず、その日の便を終了する", async ({
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
    await expect(
      page.getByText("運営に報告し、この写真を今回の選択から外しました"),
    ).toBeVisible();
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

  test("別端末で先に選ばれた1匹へ静かに収束する", async ({ page }) => {
    await seedPendingEveningDelivery(page, "canonical-server-choice");
    await mockFourChoiceExchange(page, {
      canonical: {
        state: "kept",
        selectedPhotoId: "four-choice-delivery-2",
      },
    });

    await page.goto("/home");
    await page.getByTestId("desk-open-letter").click();
    const choiceDialog = page.getByTestId("evening-four-choice");
    await choiceDialog
      .locator(
        '[data-testid="evening-four-choice-option"][data-photo-id="four-choice-delivery-4"]',
      )
      .click();
    await choiceDialog.getByTestId("evening-four-choice-save").click();

    await expect.poll(() => readEveningSelection(page)).toEqual({
      keptPhotoIds: ["four-choice-delivery-2"],
      selectedPhotoId: "four-choice-delivery-2",
      hasKeptAt: true,
    });
    await expect(choiceDialog.getByTestId("evening-four-choice-saved")).toBeVisible();
  });

  test("サーバー確定に失敗したら仮選択を残して保存しない", async ({ page }) => {
    await seedPendingEveningDelivery(page, "server-choice-failure");
    await mockFourChoiceExchange(page);
    await page.route("**/api/sleeping-delivery/choice", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "choice_unavailable" }),
      });
    });

    await page.goto("/home");
    await page.getByTestId("desk-open-letter").click();
    const choiceDialog = page.getByTestId("evening-four-choice");
    const selectedPhotoId = "four-choice-delivery-3";
    await choiceDialog
      .locator(
        `[data-testid="evening-four-choice-option"][data-photo-id="${selectedPhotoId}"]`,
      )
      .click();
    await choiceDialog.getByTestId("evening-four-choice-save").click();

    await expect(choiceDialog).toBeVisible();
    await expect(choiceDialog.getByRole("alert")).toBeVisible();
    await expect.poll(() => readKeptPhotoIds(page)).toEqual([]);
    await expect.poll(() => readEveningDraftSelection(page)).toBe(selectedPhotoId);
  });

  test("確定済みbundleの再取得では4枚を再表示しない", async ({ page }) => {
    const selectedPhotoId = "four-choice-delivery-2";
    await seedPendingEveningDelivery(page, "resolved-bundle-replay");
    await mockFourChoiceExchange(page, {
      exchangeResolution: {
        state: "kept",
        selectedPhotoId,
      },
    });

    await page.goto("/home");

    await expect.poll(() => readEveningSelection(page)).toEqual({
      keptPhotoIds: [selectedPhotoId],
      selectedPhotoId,
      hasKeptAt: true,
    });
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);
    await expect(page.getByTestId("evening-four-choice")).toHaveCount(0);
  });

  test("確定後に報告された写真は別端末で復元しない", async ({ page }) => {
    const unavailablePhotoId = "four-choice-delivery-2";
    await seedPendingEveningDelivery(page, "reported-resolution-replay");
    await mockFourChoiceExchange(page, {
      photos: fourCandidates.filter((photo) => photo.id !== unavailablePhotoId),
      exchangeResolution: {
        state: "kept",
        selectedPhotoId: unavailablePhotoId,
      },
    });

    await page.goto("/home");

    await expect.poll(() => readSkippedEveningDelivery(page)).toEqual({
      hasArrival: false,
      hasDraftSelection: false,
      hasSkippedAt: true,
    });
    await expect.poll(() => readKeptPhotoIds(page)).toEqual([]);
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);
  });

  test("候補が3枚になっても有効な確定写真を復元する", async ({ page }) => {
    const selectedPhotoId = "four-choice-delivery-4";
    await seedPendingEveningDelivery(page, "partial-resolution-replay");
    await mockFourChoiceExchange(page, {
      photos: fourCandidates.filter(
        (photo) => photo.id !== "four-choice-delivery-2",
      ),
      exchangeResolution: {
        state: "kept",
        selectedPhotoId,
      },
    });

    await page.goto("/home");

    await expect.poll(() => readEveningSelection(page)).toEqual({
      keptPhotoIds: [selectedPhotoId],
      selectedPhotoId,
      hasKeptAt: true,
    });
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);
  });

  test("確定写真を含む全候補が除外済みでも再試行を続けない", async ({ page }) => {
    await seedPendingEveningDelivery(page, "empty-resolution-replay");
    const readExchangeCalls = await mockFourChoiceExchange(page, {
      photos: [],
      exchangeResolution: {
        state: "kept",
        selectedPhotoId: "four-choice-delivery-2",
      },
    });

    await page.goto("/home");

    await expect.poll(() => readSkippedEveningDelivery(page)).toEqual({
      hasArrival: false,
      hasDraftSelection: false,
      hasSkippedAt: true,
    });
    await expect.poll(readExchangeCalls).toBe(1);
    await expect(page.getByTestId("desk-open-letter")).toHaveCount(0);
  });
});

async function mockFourChoiceExchange(
  page: Page,
  options: {
    photos?: typeof fourCandidates;
    canonical?: {
      state: "kept" | "skipped" | "expired";
      selectedPhotoId: string | null;
    };
    exchangeResolution?: {
      state: "kept" | "skipped" | "expired";
      selectedPhotoId: string | null;
    };
  } = {},
) {
  let exchangeCalls = 0;
  let canonical = options.canonical ?? null;
  const responsePhotos = options.photos ?? fourCandidates;

  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    exchangeCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photo: responsePhotos[0] ?? null,
        photos: responsePhotos,
        source: "remote",
        tier: 1,
        bundleId: BUNDLE_ID,
        experienceVersion: "evening_choice_v1",
        assignedVariant: "four_choice_v1",
        servedVariant: "four_choice_v1",
        requestedCount: 4,
        servedCount: responsePhotos.length,
        requestedCandidateCount: 4,
        returnedCandidateCount: responsePhotos.length,
        choiceResolution: options.exchangeResolution?.state ?? null,
        selectedPhotoId: options.exchangeResolution?.selectedPhotoId ?? null,
        choiceResolvedAt: options.exchangeResolution
          ? "2026-07-22T11:06:00.000Z"
          : null,
      }),
    });
  });

  await page.route("**/api/sleeping-delivery/choice", async (route) => {
    const request = route.request().postDataJSON() as {
      operation?: string;
      selectedPhotoId?: string | null;
    };
    const requested = {
      state: request.operation === "keep" ? ("kept" as const) : ("skipped" as const),
      selectedPhotoId:
        request.operation === "keep" ? (request.selectedPhotoId ?? null) : null,
    };
    const isFirstResolution = canonical === null;
    canonical ??= requested;
    const isSame =
      canonical.state === requested.state &&
      canonical.selectedPhotoId === requested.selectedPhotoId;
    const resolvedAt = "2026-07-22T11:06:00.000Z";

    await route.fulfill({
      status: isSame ? 200 : 409,
      contentType: "application/json",
      body: JSON.stringify(
        isSame
          ? {
              ok: true,
              ...canonical,
              resolvedAt,
              idempotent: !isFirstResolution,
            }
          : {
              ok: false,
              error: "choice_already_resolved",
              canonical: { ...canonical, resolvedAt },
            },
      ),
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
