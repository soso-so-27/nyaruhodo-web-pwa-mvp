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

  test("fails visibly when an expected handoff photo cannot be persisted", () => {
    const teardown = installMemoryWindow({
      rejectKey: "nyaruhodo_exchange_own_sleeping_photos",
    });
    const payload = {
      version: 1,
      createdAt: "2026-07-13T00:00:00.000Z",
      source: "instagram_bio",
      onboardingCompleted: true,
      catProfiles: [{ id: "cat-1", name: "むぎ" }],
      activeCatId: "cat-1",
      ownSleepingPhotos: [
        {
          id: "onboarding-own-1",
          catId: "cat-1",
          ownerCatId: "cat-1",
          src: "data:image/png;base64,AAAA",
          state: "sleeping",
          visibility: "shared",
          deliveryStatus: "available",
          triggerLabel: "ねがお",
          theme: "sleeping",
          shared: true,
          createdAt: 1_789_000_000_000,
          captureContext: "onboarding",
        },
      ],
      keptExchangePhotos: [],
      pendingReferralCode: null,
      onboardingProgress: null,
    };

    try {
      expect(() => restoreOnboardingHandoffPayload(payload)).toThrow(
        "handoff_local_storage_failed",
      );
    } finally {
      teardown();
    }
  });

  test("keeps target-browser history when restoring an intro handoff", () => {
    const teardown = installMemoryWindow();
    const ownPhotos = JSON.stringify([{ id: "existing-own" }]);
    const keptPhotos = JSON.stringify([{ id: "existing-kept" }]);
    const payload = {
      version: 1,
      createdAt: "2026-07-19T00:00:00.000Z",
      source: "instagram_bio",
      entryPoint: "onboarding_intro",
      journey: {
        version: 1,
        id: "onbj_00000000-0000-4000-8000-000000000002",
        dateKey: "2026-07-19",
        source: "instagram_bio",
        resumeToken: "onbr_0000000000000000000000000000000000000000",
        createdAt: 1_789_000_000_000,
      },
      onboardingCompleted: false,
      catProfiles: [],
      activeCatId: null,
      ownSleepingPhotos: [],
      keptExchangePhotos: [],
      pendingReferralCode: null,
      onboardingProgress: null,
      session: null,
    };

    try {
      window.localStorage.setItem(
        "nyaruhodo_exchange_own_sleeping_photos",
        ownPhotos,
      );
      window.localStorage.setItem(
        KEPT_EXCHANGE_PHOTO_STORAGE_KEY,
        keptPhotos,
      );

      expect(restoreOnboardingHandoffPayload(payload)).toMatchObject({
        ownSleepingPhotoCount: 0,
        keptExchangePhotoCount: 0,
        entryPoint: "onboarding_intro",
        journeyId: payload.journey.id,
      });
      expect(
        window.localStorage.getItem(
          "nyaruhodo_exchange_own_sleeping_photos",
        ),
      ).toBe(ownPhotos);
      expect(
        window.localStorage.getItem(KEPT_EXCHANGE_PHOTO_STORAGE_KEY),
      ).toBe(keptPhotos);
      expect(window.localStorage.getItem("onboarding_completed")).toBeNull();
      expect(
        JSON.parse(
          window.localStorage.getItem("neteruneko_onboarding_journey") ?? "null",
        ),
      ).toMatchObject({ id: payload.journey.id });
    } finally {
      teardown();
    }
  });
});

function installMemoryWindow({ rejectKey }: { rejectKey?: string } = {}) {
  const originalWindow = (globalThis as { window?: Window }).window;
  const localStore = new Map<string, string>();
  const sessionStore = new Map<string, string>();
  const createStorage = (store: Map<string, string>) => ({
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === rejectKey) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  const windowStub = {
    localStorage: createStorage(localStore),
    sessionStorage: createStorage(sessionStore),
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
