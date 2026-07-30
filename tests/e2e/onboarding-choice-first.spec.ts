import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const photoBuffer = fs.readFileSync(
  path.resolve(process.cwd(), "public/sample-cats/pose-box.webp"),
);
const replacementPhotoBuffer = fs.readFileSync(
  path.resolve(process.cwd(), "public/sample-cats/mugi-portrait.webp"),
);
const choicePhotoDataUrls = [
  "neko-kuji-curled-1.webp",
  "neko-kuji-curled-2.webp",
  "neko-kuji-curled-3.webp",
  "neko-kuji-curled-5.webp",
].map((fileName) => {
  const buffer = fs.readFileSync(
    path.resolve(process.cwd(), "public/sample-cats", fileName),
  );
  return `data:image/webp;base64,${buffer.toString("base64")}`;
});

test.describe("own-photo-first ねこくじ onboarding", () => {
  test("explains the value, confirms an own photo, then completes the four-cat draw", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const requests: Array<Record<string, unknown>> = [];
    let selectedPhotoId = "";

    await mockChoiceFirstApis(page, {
      onExchange: (body) => requests.push(body),
      onChoice: (body) => {
        selectedPhotoId = String(body.selectedPhotoId ?? "");
      },
    });

    await page.goto("/onboarding?source=instagram_story");
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });

    await expect(
      page.getByRole("heading", {
        name: "スマホには、撮った写真。 ねてるねこには、 自分で選んだ写真。",
      }),
    ).toBeVisible();
    await expect(
      page.getByTestId("onboarding-value-photo-stack"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("onboarding-intro")
        .getByText("ねこくじ", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "artifacts/onboarding-final-01-value.png",
      fullPage: true,
    });
    expect(requests).toHaveLength(0);

    await page.getByTestId("onboarding-intro-next").click();
    await expect(page.getByText("ねこくじ", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "いろんな猫を見ると、 うちの子らしさが 見えてくる。",
      }),
    ).toBeVisible();
    await expect(
      page.getByTestId("onboarding-kuji-cat-collage"),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-intro")).toContainText(
      "写真を1枚選ぶと、4匹が登場します。",
    );
    await expect(
      page.getByTestId("onboarding-photo-select"),
    ).toHaveText("うちの子の写真を1枚選ぶ");
    await page.screenshot({
      path: "artifacts/onboarding-final-02-kuji.png",
      fullPage: true,
    });
    expect(requests).toHaveLength(0);

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("onboarding-photo-select").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "own-cat.webp",
      mimeType: "image/webp",
      buffer: photoBuffer,
    });

    const review = page.getByTestId("onboarding-photo-review");
    await expect(review).toBeVisible();
    await expect(review.getByRole("heading")).toHaveText(
      "この写真を「うちのこ」に保存しますか？",
    );
    await expect(page.getByTestId("onboarding-photo-review-image")).toBeVisible();
    await expect(review).toContainText("保存すると、ねこくじが始まります。");
    await expect(review).toContainText(
      "運営が確認したあと、この写真もだれかのねこくじに登場することがあります。",
    );
    await expect(page.getByTestId("onboarding-photo-confirm")).toHaveText(
      "保存して、ねこくじへ",
    );
    await expect(page.getByTestId("onboarding-photo-reselect")).toHaveText(
      "写真を選び直す",
    );
    await page.screenshot({
      path: "artifacts/onboarding-final-03-photo-confirm.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 568 });
    const photoConfirmBox = await page
      .getByTestId("onboarding-photo-confirm")
      .boundingBox();
    expect(photoConfirmBox).not.toBeNull();
    expect(
      (photoConfirmBox?.y ?? 0) + (photoConfirmBox?.height ?? 0),
    ).toBeLessThanOrEqual(568);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await readOwnSleepingPhotos(page)).toHaveLength(0);
    expect(requests).toHaveLength(0);
    await page.getByTestId("onboarding-photo-confirm").click();

    const choices = page.getByTestId("onboarding-four-choice-option");
    await expect(choices).toHaveCount(4);
    await expect(
      page.getByText("気になるのは、どの子？", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-own-photo-saved")).toHaveText(
      "写真を「うちのこ」に保存しました",
    );
    await expect(page.getByTestId("onboarding-four-choice")).toContainText(
      "気になる子をタップすると、大きく見られます。",
    );
    await expect(
      page.getByRole("button", { name: "今回は選ばない" }),
    ).toBeVisible();
    await page.screenshot({
      path: "artifacts/onboarding-final-04-four-cats.png",
      fullPage: true,
    });
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toMatchObject({
      mode: "onboarding",
      requestedCandidateCount: 4,
      ownPhoto: {
        shared: true,
      },
    });

    await choices.nth(1).click();
    const preview = page.getByTestId("onboarding-four-choice-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-tone", "paper");
    await expect(preview).toHaveAttribute(
      "data-photo-id",
      "onboarding-preview-choice-2",
    );
    await expect(preview.getByRole("heading")).toHaveText(
      "この子を選びますか？",
    );
    await expect(preview).toContainText(
      "選んだ1匹は、ねてるねこであとから見られます。",
    );
    await expect(
      preview.getByTestId("onboarding-four-choice-save"),
    ).toHaveText("この子を選ぶ");
    await expect(
      preview.getByTestId("onboarding-four-choice-preview-back"),
    ).toContainText("4匹に戻る");
    await expect(
      preview.getByTestId("onboarding-four-choice-preview-thumbnail"),
    ).toHaveCount(4);
    await page.screenshot({
      path: "artifacts/onboarding-final-05-cat-preview.png",
      fullPage: true,
    });
    await expect(choices.nth(1)).toHaveAttribute("data-selected", "false");
    await page.goBack();
    await expect(preview).toHaveCount(0);
    await expect(choices).toHaveCount(4);
    await expect(page).toHaveURL(/\/onboarding/);
    await choices.nth(1).click();
    const keepButton = page.getByTestId("onboarding-four-choice-save");
    await expect(keepButton).toHaveText("この子を選ぶ");
    await page.setViewportSize({ width: 320, height: 568 });
    const box = await keepButton.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(568);

    await page.setViewportSize({ width: 390, height: 844 });
    await keepButton.click();
    await expect(page.getByTestId("onboarding-completion-own-photo")).toBeVisible();
    await expect(page.getByTestId("onboarding-completion-title")).toHaveText(
      "うちの子の1枚を保存しました。",
    );
    await expect(page.getByTestId("onboarding-completion-value")).toContainText(
      "いろんな猫に目をとめるたび、うちの子の好きなところや、その子らしさに気づいていけます。",
    );
    await expect(page.getByTestId("onboarding-completion-dayori")).toContainText(
      "ねこくじで選んだ1匹が、この日の「ねこだより」になりました。",
    );
    await expect(page.getByText("よその子", { exact: false })).toHaveCount(0);
    await expect(page.getByText("ほかの猫", { exact: false })).toHaveCount(0);
    await page.screenshot({
      path: "artifacts/onboarding-final-06-complete.png",
      fullPage: true,
    });
    expect(requests).toHaveLength(1);
    expect(selectedPhotoId).toBe("onboarding-preview-choice-2");

    await page.getByTestId("onboarding-completion-nekodayori").click();
    await page.waitForURL(/\/collection$/);
    await expect(
      page.getByTestId("nekodayori-current-saved-photo"),
    ).toHaveAttribute("data-photo-id", "onboarding-preview-choice-2");
  });

  test("restores the same four cats after the own photo was saved without fetching another set", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    await mockChoiceFirstApis(page, {
      onExchange: () => {
        exchangeCalls += 1;
      },
    });

    await page.goto("/onboarding");
    await advanceToPhotoSelection(page);
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("onboarding-photo-select").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "own-cat.webp",
      mimeType: "image/webp",
      buffer: photoBuffer,
    });
    await expect(page.getByTestId("onboarding-photo-review")).toBeVisible();
    expect(await readOwnSleepingPhotos(page)).toHaveLength(0);
    expect(exchangeCalls).toBe(0);
    await page.getByTestId("onboarding-photo-confirm").click();

    const choices = page.getByTestId("onboarding-four-choice-option");
    await expect(choices).toHaveCount(4);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem(
            "neteruneko_onboarding_progress",
          );
          return raw ? JSON.parse(raw).stage : null;
        }),
      )
      .toBe("arrived");
    expect(exchangeCalls).toBe(1);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem("cat_profiles");
          return raw ? JSON.parse(raw).length : 0;
        }),
      )
      .toBeGreaterThan(0);
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByTestId("onboarding-four-choice-option")).toHaveCount(
      4,
    );
    await expect(
      page.getByText("気になるのは、どの子？", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-own-photo-saved")).toBeVisible();
    expect(exchangeCalls).toBe(1);

    await page.getByTestId("onboarding-four-choice-option").first().click();
    const preview = page.getByTestId("onboarding-four-choice-preview");
    await expect(preview).toHaveAttribute(
      "data-photo-id",
      "onboarding-preview-choice-1",
    );
    await expect(
      preview.getByTestId("onboarding-four-choice-save"),
    ).toHaveText("この子を選ぶ");
    await expect(page.getByTestId("onboarding-photo-prompt")).toHaveCount(0);
  });

  test("finishes with the own photo only when the visitor skips the four cats", async ({
    page,
  }) => {
    const choices: Array<Record<string, unknown>> = [];
    await mockChoiceFirstApis(page, {
      onChoice: (body) => choices.push(body),
    });

    await page.goto("/onboarding");
    await advanceToPhotoSelection(page);
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("onboarding-photo-select").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "own-cat.webp",
      mimeType: "image/webp",
      buffer: photoBuffer,
    });
    await expect(page.getByTestId("onboarding-photo-review")).toBeVisible();
    await page.getByTestId("onboarding-photo-confirm").click();
    await expect(page.getByTestId("onboarding-four-choice-option")).toHaveCount(
      4,
    );

    await page.getByTestId("onboarding-four-choice-skip").click();

    await expect(page.getByTestId("onboarding-completion-own-photo")).toBeVisible();
    await expect(page.getByTestId("onboarding-completion-title")).toHaveText(
      "うちの子の1枚を保存しました。",
    );
    await expect(page.getByTestId("onboarding-completion-dayori")).toHaveCount(0);
    await expect(
      page.getByTestId("onboarding-completion-nekodayori"),
    ).toHaveCount(0);
    await expect(page.getByTestId("onboarding-delivered-continue")).toHaveText(
      "うちのこを見る",
    );
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({
      operation: "skip",
      selectedPhotoId: null,
    });
  });

  test("reselects without side effects and saves only the confirmed second photo", async ({
    page,
  }) => {
    const requests: Array<Record<string, unknown>> = [];
    await mockChoiceFirstApis(page, {
      onExchange: (body) => requests.push(body),
    });

    await page.goto("/onboarding");
    await advanceToPhotoSelection(page);
    const firstChooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("onboarding-photo-select").click();
    const firstChooser = await firstChooserPromise;
    await firstChooser.setFiles({
      name: "first-own-cat.webp",
      mimeType: "image/webp",
      buffer: photoBuffer,
    });

    const reviewImage = page.getByTestId("onboarding-photo-review-image");
    await expect(page.getByTestId("onboarding-photo-review")).toBeVisible();
    const firstPreviewSrc = await reviewImage.getAttribute("src");
    expect(firstPreviewSrc).toBeTruthy();
    expect(await readOwnSleepingPhotos(page)).toHaveLength(0);
    expect(requests).toHaveLength(0);

    const replacementChooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("onboarding-photo-reselect").click();
    const replacementChooser = await replacementChooserPromise;
    await replacementChooser.setFiles({
      name: "second-own-cat.webp",
      mimeType: "image/webp",
      buffer: replacementPhotoBuffer,
    });

    await expect(page.getByTestId("onboarding-photo-review")).toBeVisible();
    await expect
      .poll(() => reviewImage.getAttribute("src"))
      .not.toBe(firstPreviewSrc);
    expect(await readOwnSleepingPhotos(page)).toHaveLength(0);
    expect(requests).toHaveLength(0);

    await page.getByTestId("onboarding-photo-confirm").click();
    await expect(page.getByTestId("onboarding-four-choice-option")).toHaveCount(
      4,
    );
    await expect.poll(() => readOwnSleepingPhotos(page)).toHaveLength(1);
    const savedPhotos = await readOwnSleepingPhotos(page);
    expect(savedPhotos[0]).toMatchObject({
      width: 600,
      height: 520,
    });
    expect(requests).toHaveLength(1);
  });

  test("returns to the photo-selection screen after rejecting an unsupported file", async ({
    page,
  }) => {
    const requests: Array<Record<string, unknown>> = [];
    await mockChoiceFirstApis(page, {
      onExchange: (body) => requests.push(body),
    });

    await page.goto("/onboarding");
    await advanceToPhotoSelection(page);
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("onboarding-photo-select").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "not-a-photo.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a photo", "utf8"),
    });

    await expect(
      page.getByText("JPEGやPNGなどの写真を選んでください。", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-photo-select")).toHaveText(
      "うちの子の写真を1枚選ぶ",
    );
    await expect(
      page.getByRole("heading", {
        name: "いろんな猫を見ると、 うちの子らしさが 見えてくる。",
      }),
    ).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test("retries the draw with the already saved own photo", async ({ page }) => {
    let exchangeCalls = 0;
    await page.route("**/api/admin/capabilities", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isAdmin: true,
          testToolsEnabled: true,
          stockAdminEnabled: false,
        }),
      });
    });
    await mockChoiceFirstApis(page, {
      failExchangeCalls: 1,
      onExchange: () => {
        exchangeCalls += 1;
      },
    });

    await page.goto("/onboarding?test");
    await advanceToPhotoSelection(page);
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("onboarding-photo-select").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "own-cat.webp",
      mimeType: "image/webp",
      buffer: photoBuffer,
    });
    await expect(page.getByTestId("onboarding-photo-review")).toBeVisible();
    expect(await readOwnSleepingPhotos(page)).toHaveLength(0);
    expect(exchangeCalls).toBe(0);
    await page.getByTestId("onboarding-photo-confirm").click();

    await expect(
      page.getByText(
        "候補の確認で止まりました。テスト用に、ここで候補を追加できます。",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("onboarding-delivery-retry")).toHaveText(
      "もう一度試す",
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem(
            "nyaruhodo_exchange_own_sleeping_photos",
          );
          return raw ? JSON.parse(raw).length : 0;
        }),
      )
      .toBe(1);
    await expect.poll(() => readOwnPhotoRecordStats(page)).toEqual({
      milestoneOneCount: 1,
      takenCount: 1,
    });

    await page.getByTestId("onboarding-delivery-retry").click();
    await expect(page.getByTestId("onboarding-four-choice-option")).toHaveCount(
      4,
    );
    expect(exchangeCalls).toBe(2);
    expect(
      await page.evaluate(() => {
        const raw = window.localStorage.getItem(
          "nyaruhodo_exchange_own_sleeping_photos",
        );
        return raw ? JSON.parse(raw).length : 0;
      }),
    ).toBe(1);
    expect(await readOwnPhotoRecordStats(page)).toEqual({
      milestoneOneCount: 1,
      takenCount: 1,
    });
  });
});

async function advanceToPhotoSelection(page: Page) {
  const nextButton = page.getByTestId("onboarding-intro-next");
  const photoSelect = page.getByTestId("onboarding-photo-select");
  await expect(nextButton.or(photoSelect).first()).toBeVisible();
  if (await nextButton.isVisible()) {
    await nextButton.click();
  }
  await expect(photoSelect).toBeVisible();
}

async function readOwnPhotoRecordStats(page: Page) {
  return page.evaluate(() => {
    const stats = JSON.parse(
      window.localStorage.getItem("neteruneko_cat_sleeping_stats") ?? "{}",
    ) as Record<string, { takenCount?: number }>;
    const milestones = JSON.parse(
      window.localStorage.getItem("neteruneko_cat_sleeping_milestones") ?? "{}",
    ) as Record<string, Array<{ target?: number }>>;

    return {
      milestoneOneCount: Object.values(milestones)
        .flat()
        .filter((milestone) => milestone.target === 1).length,
      takenCount: Object.values(stats).reduce(
        (total, stat) => total + (stat.takenCount ?? 0),
        0,
      ),
    };
  });
}

async function readOwnSleepingPhotos(page: Page) {
  return page.evaluate(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(
          "nyaruhodo_exchange_own_sleeping_photos",
        ) ?? "[]",
      );
      return Array.isArray(parsed)
        ? (parsed as Array<{ width?: number; height?: number }>)
        : [];
    } catch {
      return [];
    }
  });
}

async function mockChoiceFirstApis(
  page: Page,
  {
    onExchange,
    onChoice,
    failExchangeCalls = 0,
  }: {
    onExchange?: (body: Record<string, unknown>) => void;
    onChoice?: (body: Record<string, unknown>) => void;
    failExchangeCalls?: number;
  } = {},
) {
  const photos = Array.from({ length: 4 }, (_, index) => ({
    id: `onboarding-preview-choice-${index + 1}`,
    sourcePhotoId: `stock-photo-${index + 1}`,
    src: choicePhotoDataUrls[index],
    title: "",
    subtitle: "",
    triggerLabel: "ねがお",
    theme: "sleeping",
    deliveredAt: Date.now(),
  }));

  await page.route("**/api/onboarding/submission", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  let exchangeCallCount = 0;
  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    const body = readJsonBody(route);
    exchangeCallCount += 1;
    onExchange?.(body);
    if (exchangeCallCount <= failExchangeCalls) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporary_unavailable" }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        photo: photos[0],
        photos,
        bundleId: "onboarding-preview",
        experienceVersion: "onboarding_choice_v1",
        assignedVariant: "four_choice_v1",
        servedVariant: "four_choice_v1",
        requestedCount: 4,
        servedCount: 4,
        requestedCandidateCount: 4,
        returnedCandidateCount: 4,
        source: "remote",
      }),
    });
  });
  await page.route("**/api/onboarding/choice", async (route) => {
    const body = readJsonBody(route);
    onChoice?.(body);
    const isSkip = body.operation === "skip";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        state: isSkip ? "skipped" : "kept",
        selectedPhotoId: isSkip ? null : body.selectedPhotoId,
        resolvedAt: new Date().toISOString(),
      }),
    });
  });
}

function readJsonBody(route: Route) {
  return JSON.parse(route.request().postData() || "{}") as Record<
    string,
    unknown
  >;
}
