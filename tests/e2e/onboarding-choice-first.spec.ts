import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const photoBuffer = fs.readFileSync(
  path.resolve(process.cwd(), "public/sample-cats/gray.webp"),
);
const photoDataUrl = `data:image/webp;base64,${photoBuffer.toString("base64")}`;

test.describe("choice-first onboarding", () => {
  test("shows four cats immediately, opens the photo picker from the preview, and lands in ねこだより", async ({
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

    await expect(
      page.getByText("気になるのは、どの子？", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "受け取るときに、あなたの猫の写真を1枚選びます。",
        { exact: true },
      ),
    ).toBeVisible();

    const choices = page.getByTestId("onboarding-four-choice-option");
    await expect(choices).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: "やめる" }),
    ).toHaveCount(0);
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toMatchObject({
      mode: "onboarding",
      onboardingPhase: "preview",
      requestedCandidateCount: 4,
    });
    expect(requests[0]).not.toHaveProperty("ownPhoto");

    await choices.nth(1).click();
    const preview = page.getByTestId("onboarding-four-choice-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-tone", "paper");
    await expect(preview).toHaveAttribute(
      "data-photo-id",
      "onboarding-preview-choice-2",
    );
    await expect(preview.getByRole("heading")).toHaveText(
      "この子を受け取る？",
    );
    await expect(preview).toContainText("相手に届くのは写真だけです");
    await expect(
      preview.getByTestId("onboarding-four-choice-preview-thumbnail"),
    ).toHaveCount(4);
    await expect(choices.nth(1)).toHaveAttribute("data-selected", "false");
    await page.goBack();
    await expect(preview).toHaveCount(0);
    await expect(choices).toHaveCount(4);
    await expect(page).toHaveURL(/\/onboarding/);
    await choices.nth(1).click();
    const photoInvite = page.getByTestId("onboarding-photo-invite");
    await expect(photoInvite).toHaveText("あなたの猫の写真を選ぶ");
    await page.setViewportSize({ width: 320, height: 568 });
    const box = await photoInvite.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(568);

    const fileChooserPromise = page.waitForEvent("filechooser");
    await photoInvite.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "own-cat.webp",
      mimeType: "image/webp",
      buffer: photoBuffer,
    });

    await page.waitForURL(/\/collection$/);
    await expect(page.getByTestId("onboarding-save-notice")).toHaveText(
      "ねこだよりに残しました",
    );
    await expect(
      page.getByTestId("nekodayori-current-saved-photo"),
    ).toHaveAttribute("data-photo-id", "onboarding-preview-choice-2");
    await expect(page.getByTestId("onboarding-joined")).toHaveCount(0);
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]).toMatchObject({
      mode: "onboarding",
      onboardingPhase: "commit",
      requestedCandidateCount: 4,
      ownPhoto: {
        shared: true,
      },
    });
    expect(selectedPhotoId).toBe("onboarding-preview-choice-2");

    await page.reload();
    await expect(page.getByTestId("onboarding-save-notice")).toHaveCount(0);
    await expect(
      page.getByTestId("nekodayori-current-saved-photo"),
    ).toHaveAttribute("data-photo-id", "onboarding-preview-choice-2");
  });

  test("restores photo_pending in the same large preview without fetching another set", async ({
    page,
  }) => {
    let exchangeCalls = 0;
    await mockChoiceFirstApis(page, {
      onExchange: () => {
        exchangeCalls += 1;
      },
    });

    await page.goto("/onboarding");
    const choices = page.getByTestId("onboarding-four-choice-option");
    await expect(choices).toHaveCount(4);
    await choices.first().click();

    const preview = page.getByTestId("onboarding-four-choice-preview");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await preview.getByTestId("onboarding-photo-invite").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([]);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem(
            "neteruneko_onboarding_progress",
          );
          return raw ? JSON.parse(raw).stage : null;
        }),
      )
      .toBe("photo_pending");

    await page.reload();
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute(
      "data-photo-id",
      "onboarding-preview-choice-1",
    );
    await expect(preview.getByRole("heading")).toHaveText(
      "この子を受け取る？",
    );
    await expect(
      preview.getByTestId("onboarding-photo-invite"),
    ).toHaveText("あなたの猫の写真を選ぶ");
    await expect(page.getByTestId("onboarding-photo-prompt")).toHaveCount(0);
    expect(exchangeCalls).toBe(1);
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
