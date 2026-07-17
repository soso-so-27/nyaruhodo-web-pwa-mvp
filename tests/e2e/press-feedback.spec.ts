import { expect, test, type Locator, type Page } from "@playwright/test";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEJSURBVHhe7dExEcAgAMBAJKKuTpnpjoLA/fACchlrzv2C+a0njDPsVmfYrQyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTGkBhDYgyJMSTmB4RCEqdGtA/tAAAAAElFTkSuQmCC";

test("gives primary controls, navigation, and photos a quiet physical press", async ({
  page,
}) => {
  await seedPressFeedbackState(page);

  await page.goto("/settings");
  const appButton = page.locator('[data-app-pressable="button"]').first();
  await expect(appButton).toBeVisible();
  await expect(appButton).toHaveCSS("touch-action", "manipulation");
  await expectQuietPress(page, appButton, { scale: 0.985, translateY: 1 });

  await page.goto("/cats");
  const navButtons = page.locator(
    '[data-app-bottom-nav] [data-app-pressable="nav"]',
  );
  await expect(navButtons).toHaveCount(3);
  await expectQuietPress(page, navButtons.first(), {
    scale: 0.96,
    translateY: 1,
  });

  const photoPressProbeSource = navButtons.last();
  await photoPressProbeSource.evaluate((element) => {
    element.setAttribute("data-app-pressable", "photo");
    element.setAttribute("data-testid", "photo-press-probe");
  });
  const photoPressProbe = page.getByTestId("photo-press-probe");
  await expectQuietPress(page, photoPressProbe, {
    scale: 0.99,
    translateY: 1,
  });

  await page.getByTestId("cats-section-tab-photos").click();
  const photoGrid = page.getByTestId("cats-lens-photo-grid");
  await expect(photoGrid).toBeVisible();
  await photoGrid.locator('[data-app-pressable="photo"]').first().click();
  const photoViewer = page.locator('[data-photo-viewer-motion="continuous"]');
  await expect(photoViewer).toBeVisible();
  await photoViewer.getByRole("button", { name: "写真を閉じる" }).click();
  await expect(photoViewer).toHaveCount(0);
});

test("keeps reduced-motion feedback still and uses opacity instead", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedPressFeedbackState(page);
  await page.goto("/settings");

  const appButton = page.locator('[data-app-pressable="button"]').first();
  await expect(appButton).toBeVisible();
  const box = await appButton.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(20);

  const pressed = await readPressState(appButton);
  expect(pressed.scale).toBeCloseTo(1, 3);
  expect(pressed.translateY).toBeCloseTo(0, 3);
  expect(pressed.opacity).toBeCloseTo(0.82, 2);

  await page.mouse.move(0, 0);
  await page.mouse.up();
});

test("gives the primary onboarding action a deeper press", async ({ page }) => {
  await page.goto("/onboarding?reset=1&src=press_feedback");
  await expect(page).toHaveURL(/\/onboarding\?src=press_feedback$/);

  const primaryAction = page
    .locator('[data-app-pressable="button"][data-app-button-variant="primary"]')
    .first();
  await expect(primaryAction).toBeVisible();
  await expectQuietPress(page, primaryAction, { scale: 0.97, translateY: 2 });
});

async function expectQuietPress(
  page: Page,
  target: Locator,
  expected: { scale: number; translateY: number },
) {
  const resting = await readPressState(target);
  expect(resting.scale).toBeCloseTo(1, 3);
  expect(resting.translateY).toBeCloseTo(0, 3);

  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(100);

  const pressed = await readPressState(target);
  expect(pressed.scale).toBeCloseTo(expected.scale, 3);
  expect(pressed.translateY).toBeCloseTo(expected.translateY, 1);
  expect(pressed.opacity).toBeCloseTo(1, 3);

  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.waitForTimeout(180);

  const released = await readPressState(target);
  expect(released.scale).toBeCloseTo(1, 3);
  expect(released.translateY).toBeCloseTo(0, 3);
}

async function readPressState(target: Locator) {
  return target.evaluate((element) => {
    const styles = getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(styles.transform);
    return {
      scale: matrix.a,
      translateY: matrix.f,
      opacity: Number(styles.opacity),
    };
  });
}

async function seedPressFeedbackState(page: Page) {
  await page.addInitScript((src) => {
    const now = Date.now();
    window.localStorage.setItem("onboarding_completed", "true");
    window.localStorage.setItem("neteruneko_onboarding_completed", "true");
    window.localStorage.setItem("active_cat_id", "cat-press");
    window.localStorage.setItem(
      "cat_profiles",
      JSON.stringify([
        {
          id: "cat-press",
          name: "press-test-cat",
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        },
      ]),
    );
    window.localStorage.setItem(
      "nyaruhodo_exchange_own_sleeping_photos",
      JSON.stringify([
        {
          id: "press-own-photo",
          ownerCatId: "cat-press",
          catId: "cat-press",
          src,
          thumbnailSrc: src,
          displaySrc: src,
          state: "sleeping",
          visibility: "private",
          deliveryStatus: "available",
          triggerLabel: "sleeping",
          theme: "sleeping",
          shared: false,
          createdAt: now,
        },
      ]),
    );
    window.localStorage.setItem(
      "neteruneko_cat_gallery_photos",
      JSON.stringify([
        {
          id: "press-photo",
          catId: "cat-press",
          src,
          thumbnailSrc: src,
          displaySrc: src,
          createdAt: now,
        },
      ]),
    );
    window.localStorage.setItem(
      "neteruneko_cat_gallery_intro_acknowledged",
      "true",
    );
  }, photoDataUrl);
}
