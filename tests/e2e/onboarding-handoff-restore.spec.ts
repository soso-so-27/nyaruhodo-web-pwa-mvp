import { expect, test } from "@playwright/test";

import { restoreOnboardingHandoffPayload } from "../../src/lib/onboarding/handoff";

const KEPT_EXCHANGE_PHOTO_STORAGE_KEY = "nyaruhodo_exchange_kept_photos";

test.describe("onboarding handoff restore", () => {
  test("restores the opened onboarding delivery into kept exchange photos once", () => {
    const teardown = installMemoryWindow();
    const deliveredPhoto = {
      id: "delivery-onboarding-1",
      sourcePhotoId: "stock-photo-1",
      src: "storage:delivery-archive/onboarding-delivery-1.webp",
      thumbnailSrc: "storage:delivery-archive/onboarding-delivery-1.webp",
      displaySrc: "storage:delivery-archive/onboarding-delivery-1.webp",
      originalSrc: "storage:delivery-archive/onboarding-delivery-1.webp",
      title: "ねがお",
      subtitle: "",
      triggerLabel: "ねがお",
      theme: "sleeping",
      deliveredAt: 1_788_000_000_000,
    };
    const payload = {
      version: 1,
      createdAt: "2026-07-07T00:00:00.000Z",
      source: "instagram_bio",
      onboardingCompleted: true,
      catProfiles: [],
      activeCatId: "cat-1",
      ownSleepingPhotos: [],
      keptExchangePhotos: [],
      pendingReferralCode: null,
      onboardingProgress: {
        version: 1,
        anonymousId: "anon-1",
        dateKey: "2026-07-07",
        stage: "opened",
        source: "instagram_bio",
        submissionId: "onboarding:anon-1:2026-07-07",
        deliveredPhoto,
        isDeliveredPhotoKept: true,
        updatedAt: 1_788_000_000_000,
      },
    };

    try {
      expect(restoreOnboardingHandoffPayload(payload)).toMatchObject({
        keptExchangePhotoCount: 1,
      });
      expect(restoreOnboardingHandoffPayload(payload)).toMatchObject({
        keptExchangePhotoCount: 1,
      });

      const kept = JSON.parse(
        window.localStorage.getItem(KEPT_EXCHANGE_PHOTO_STORAGE_KEY) ?? "[]",
      ) as Array<{ id?: string; sourcePhotoId?: string }>;

      expect(kept).toHaveLength(1);
      expect(kept[0]).toMatchObject({
        id: deliveredPhoto.id,
        sourcePhotoId: deliveredPhoto.sourcePhotoId,
      });
    } finally {
      teardown();
    }
  });
});

function installMemoryWindow() {
  const originalWindow = (globalThis as { window?: Window }).window;
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  const windowStub = {
    localStorage,
    addEventListener: () => undefined,
    dispatchEvent: () => true,
  } as unknown as Window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowStub,
  });

  return () => {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  };
}
