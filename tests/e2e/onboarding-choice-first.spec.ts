import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const photoBuffer = fs.readFileSync(
  path.resolve(process.cwd(), "public/sample-cats/gray.webp"),
);
const photoDataUrl = `data:image/webp;base64,${photoBuffer.toString("base64")}`;

test.describe("choice-first onboarding", () => {
  test("previews four cats, explains the exchange, and commits only after an own photo", async ({
    page,
  }) => {
    const requests: Array<Record<string, unknown>> = [];
    let selectedPhotoId = "";

    await mockChoiceFirstApis(page, {
      onExchange: (body) => requests.push(body),
      onChoice: (body) => {
        selectedPhotoId = String(body.selectedPhotoId ?? "");
      },
    });

    await page.goto("/onboarding?source=instagram_story");

    await expect(
      page.locator('[data-onboarding-title="true"]'),
    ).toHaveText("気になる子は、どの子？");
    await expect(
      page.getByTestId("onboarding-exchange-explanation"),
    ).toHaveText(
      "4匹から気になる1匹を選べます。受け取りには、うちの子の写真が1枚必要です。",
    );
    await page.getByRole("button", { name: "4匹に会ってみる" }).click();

    const choices = page.getByTestId("onboarding-four-choice-option");
    await expect(choices).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: "今回は見るだけ" }),
    ).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      mode: "onboarding",
      onboardingPhase: "preview",
      requestedCandidateCount: 4,
    });
    expect(requests[0]).not.toHaveProperty("ownPhoto");

    await choices.nth(1).click();
    const preview = page.getByTestId("onboarding-four-choice-preview");
    await expect(preview).toBeVisible();
    await expect(
      preview.getByTestId("onboarding-four-choice-preview-thumbnail"),
    ).toHaveCount(4);
    await expect(choices.nth(1)).toHaveAttribute("data-selected", "false");
    await page.goBack();
    await expect(preview).toHaveCount(0);
    await expect(choices).toHaveCount(4);
    await expect(page).toHaveURL(/\/onboarding/);
    await choices.nth(1).click();
    await preview.getByRole("button", { name: "この猫を選ぶ" }).click();

    const prompt = page.getByTestId("onboarding-photo-prompt");
    await expect(prompt).toContainText("この猫を受け取りますか？");
    await expect(prompt).toContainText(
      "うちの子の写真1枚と交換します。",
    );
    await expect(prompt).toContainText(
      "確認後、写真だけが匿名でほかの人に届くことがあります",
    );

    const photoInvite = page.getByRole("button", {
      name: "うちの子の写真を選ぶ",
    });
    const leaveWithoutExchange = page.getByRole("button", {
      name: "今回はやめる",
    });
    await page.setViewportSize({ width: 320, height: 568 });
    for (const action of [photoInvite, leaveWithoutExchange]) {
      const box = await action.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(568);
    }

    await photoInvite.click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "own-cat.webp",
      mimeType: "image/webp",
      buffer: photoBuffer,
    });

    await expect(page.getByTestId("onboarding-joined")).toBeVisible();
    await expect(page.getByTestId("onboarding-joined")).toContainText(
      "選んだ猫が届きました",
    );
    await expect(
      page.getByTestId("onboarding-joined-delivered-photo"),
    ).toHaveAttribute("data-photo-id", "onboarding-preview-choice-2");
    await expect(page.getByTestId("onboarding-joined-own-photo")).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({
      mode: "onboarding",
      onboardingPhase: "commit",
      requestedCandidateCount: 4,
      ownPhoto: {
        shared: true,
      },
    });
    expect(selectedPhotoId).toBe("onboarding-preview-choice-2");
  });

  test("restores the provisional choice and lets a visitor leave without exchanging", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    await mockChoiceFirstApis(page, {
      onExchange: () => {
        exchangeCalls += 1;
      },
    });

    await page.goto("/onboarding");
    await page.getByRole("button", { name: "4匹に会ってみる" }).click();
    await page.getByTestId("onboarding-four-choice-option").first().click();
    await page.getByRole("button", { name: "この猫を選ぶ" }).click();
    await expect(page.getByTestId("onboarding-photo-prompt")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("onboarding-photo-prompt")).toBeVisible();
    expect(exchangeCalls).toBe(1);

    await page
      .getByRole("button", { name: "今回はやめる" })
      .click();
    await expect(page).toHaveURL(/\/home$/);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem(
            "neteruneko_onboarding_progress",
          );
          return raw ? JSON.parse(raw).stage : null;
        }),
      )
      .toBe("skipped");

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/home$/);
  });
});

async function mockChoiceFirstApis(
  page: Page,
  {
    onExchange,
    onChoice,
  }: {
    onExchange?: (body: Record<string, unknown>) => void;
    onChoice?: (body: Record<string, unknown>) => void;
  } = {},
) {
  const photos = Array.from({ length: 4 }, (_, index) => ({
    id: `onboarding-preview-choice-${index + 1}`,
    sourcePhotoId: `stock-photo-${index + 1}`,
    src: photoDataUrl,
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
  await page.route("**/api/sleeping-delivery/exchange", async (route) => {
    const body = readJsonBody(route);
    onExchange?.(body);
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
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        state: "kept",
        selectedPhotoId: body.selectedPhotoId,
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
