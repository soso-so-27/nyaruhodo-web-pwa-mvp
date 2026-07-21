import { expect, test } from "@playwright/test";

import {
  autoOpenExpiredEveningDeliveries,
  buildEveningHomeState,
  getEveningDeliveryTargetDateKey,
  getPendingEveningDeliveryDay,
  getSystemOpenedEveningDeliveryNotice,
  getJstDateKey,
  markEveningDeliveryKept,
  readEveningDeliveryStore,
  recordOnboardingEveningDeliveryTarget,
  selectEveningDeliveredPhoto,
  setEveningDeliveryDraftSelection,
  setEveningDeliveredPhoto,
  setEveningDeliveredPhotos,
  updateEveningDeliveredPhotoDataUrl,
  writeEveningDeliveryStore,
} from "../../src/lib/home/eveningDelivery";
import {
  reportExchangePhoto,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../../src/lib/home/sleepingPhotos";
import {
  getServerJstDateKey,
  validateServerDeliveryDateKey,
} from "../../src/lib/home/eveningDeliveryServer";

const DELIVERY_DAY = "2026-07-10";
const DELIVERED_AT = Date.parse("2026-07-10T20:00:00+09:00");
const BEFORE_AUTO_OPEN = Date.parse("2026-07-10T20:01:00+09:00");
const AUTO_OPEN_AT = Date.parse("2026-07-11T05:00:00+09:00");

test.describe("20時 and day-reset boundaries", () => {
  test("accepts the server exchange window from 19:55 JST", () => {
    const cases = [
      ["2026-07-10T19:54:59+09:00", "delivery_not_yet"],
      ["2026-07-10T19:55:00+09:00", "ok"],
      ["2026-07-10T19:59:59+09:00", "ok"],
      ["2026-07-10T20:00:00+09:00", "ok"],
      ["2026-07-10T20:04:59+09:00", "ok"],
    ] as const;

    for (const [isoTimestamp, expected] of cases) {
      const result = validateServerDeliveryDateKey({
        deliveryDateKey: DELIVERY_DAY,
        now: Date.parse(isoTimestamp),
      });

      expect(result.serverDateKey, isoTimestamp).toBe(DELIVERY_DAY);
      if (expected === "ok") {
        expect(result, isoTimestamp).toMatchObject({ ok: true });
      } else {
        expect(result, isoTimestamp).toMatchObject({
          ok: false,
          error: expected,
        });
      }
    }
  });

  test("moves new captures to tomorrow once the 20時 delivery point arrives", () => {
    expect(getEveningDeliveryTargetDateKey(Date.parse("2026-07-10T19:59:59+09:00"))).toBe(
      "2026-07-10",
    );
    expect(getEveningDeliveryTargetDateKey(Date.parse("2026-07-10T20:00:00+09:00"))).toBe(
      "2026-07-11",
    );
  });

  test("keeps JST date math stable around the 5時 home reset boundary", () => {
    expect(getJstDateKey(Date.parse("2026-07-10T04:59:59+09:00"))).toBe(
      "2026-07-10",
    );
    expect(getJstDateKey(Date.parse("2026-07-10T05:00:00+09:00"))).toBe(
      "2026-07-10",
    );
    expect(getServerJstDateKey(Date.parse("2026-07-10T04:59:59+09:00"))).toBe(
      "2026-07-10",
    );
    expect(getServerJstDateKey(Date.parse("2026-07-10T05:00:00+09:00"))).toBe(
      "2026-07-10",
    );
  });

  test("keeps a missed onboarding target recoverable until 5am", () => {
    const ownPhoto = createOnboardingPhoto(
      Date.parse("2026-07-10T19:59:00+09:00"),
    );

    expect(
      recordOnboardingEveningDeliveryTarget(
        ownPhoto,
        Date.parse("2026-07-11T04:59:59+09:00"),
      ),
    ).toMatchObject({ dateKey: "2026-07-10" });
    expect(
      recordOnboardingEveningDeliveryTarget(
        ownPhoto,
        Date.parse("2026-07-11T05:00:00+09:00"),
      ),
    ).toBeNull();
  });
});

test.describe("four-photo evening delivery state", () => {
  let restoreWindow: (() => void) | null = null;

  test.beforeEach(() => {
    restoreWindow = installMemoryWindow();
  });

  test.afterEach(() => {
    restoreWindow?.();
    restoreWindow = null;
  });

  test("persists four photos without opening or keeping the bundle", () => {
    seedTarget();
    const photos = createDeliveredPhotos(4);

    expect(
      setEveningDeliveredPhotos(DELIVERY_DAY, photos, DELIVERED_AT, {
        deliveryBundleId: "bundle-1",
        experienceVersion: "four-choice-v1",
        assignedVariant: "four_choice",
        servedVariant: "four_choice",
        requestedCount: 4,
        servedCount: 4,
        fallbackReason: null,
      }),
    ).toBe(true);

    const stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored.deliveredPhoto?.id).toBe("delivery-photo-1");
    expect(stored.deliveredPhotos?.map((photo) => photo.id)).toEqual([
      "delivery-photo-1",
      "delivery-photo-2",
      "delivery-photo-3",
      "delivery-photo-4",
    ]);
    expect(stored).toMatchObject({
      deliveryBundleId: "bundle-1",
      experienceVersion: "four-choice-v1",
      requestedCount: 4,
      servedCount: 4,
    });
    expect(stored.openedAt).toBeUndefined();
    expect(stored.keptAt).toBeUndefined();
    expect(getPendingEveningDeliveryDay(BEFORE_AUTO_OPEN)).toBeNull();
    expect(markEveningDeliveryKept(DELIVERY_DAY, DELIVERED_AT + 1)).toBe(false);

    const state = buildEveningHomeState({
      activeCatId: null,
      ownPhotos: [],
      now: BEFORE_AUTO_OPEN,
    });
    expect(state.kind).toBe("delivered");
    if (state.kind !== "delivered") {
      throw new Error("expected delivered state");
    }
    expect(state.deliveredPhotos).toHaveLength(4);
    expect(state.deliveryBundleId).toBe("bundle-1");
  });

  test("atomically confirms only the selected photo as opened and kept", () => {
    seedTarget();
    expect(
      setEveningDeliveredPhotos(
        DELIVERY_DAY,
        createDeliveredPhotos(4),
        DELIVERED_AT,
        { deliveryBundleId: "bundle-select", servedCount: 4 },
      ),
    ).toBe(true);

    const selectedAt = DELIVERED_AT + 2_000;
    expect(
      selectEveningDeliveredPhoto(
        DELIVERY_DAY,
        "delivery-photo-3",
        selectedAt,
      ),
    ).toBe(true);

    const stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored.deliveredPhoto?.id).toBe("delivery-photo-3");
    expect(stored.deliveredPhotos).toBeUndefined();
    expect(stored).toMatchObject({
      selectedPhotoId: "delivery-photo-3",
      openedAt: selectedAt,
      openedBy: "user",
      keptAt: selectedAt,
      deliveryBundleId: "bundle-select",
    });

    const state = buildEveningHomeState({
      activeCatId: null,
      ownPhotos: [],
      now: BEFORE_AUTO_OPEN,
    });
    expect(state.kind).toBe("opened");
    if (state.kind !== "opened") {
      throw new Error("expected opened state");
    }
    expect(state.deliveredPhoto.id).toBe("delivery-photo-3");
    expect(state.deliveredPhotos.map((photo) => photo.id)).toEqual([
      "delivery-photo-3",
    ]);
  });

  test("falls back to one photo when a four-photo bundle cannot be persisted whole", () => {
    seedTarget();
    const photos = createDeliveredPhotos(4);
    photos[2] = {
      ...photos[2],
      src: "https://example.com/temporary-signed-photo.jpg",
    };

    expect(
      setEveningDeliveredPhotos(DELIVERY_DAY, photos, DELIVERED_AT, {
        assignedVariant: "four_choice_v1",
        servedVariant: "four_choice_v1",
        requestedCount: 4,
        servedCount: 4,
      }),
    ).toBe(true);

    const stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored.deliveredPhoto?.id).toBe("delivery-photo-1");
    expect(stored.deliveredPhotos).toBeUndefined();
    expect(stored.servedVariant).toBe("single_v1");
    expect(stored.servedCount).toBe(1);
    expect(stored.fallbackReason).toBe("client_persistence_filter");
    expect(markEveningDeliveryKept(DELIVERY_DAY, DELIVERED_AT + 1)).toBe(true);
  });

  test("repairs a cached partial bundle to a usable single-photo delivery", () => {
    const photos = createDeliveredPhotos(4);
    photos[1] = {
      ...photos[1],
      src: "https://example.com/expired-candidate.jpg",
    };
    window.localStorage.setItem(
      "neteruneko_evening_delivery_days",
      JSON.stringify({
        [DELIVERY_DAY]: {
          dateKey: DELIVERY_DAY,
          deliveredPhoto: photos[0],
          deliveredPhotos: photos,
          deliveredAt: DELIVERED_AT,
          assignedVariant: "four_choice_v1",
          servedVariant: "four_choice_v1",
          servedCount: 4,
        },
      }),
    );

    const stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored.deliveredPhoto?.id).toBe("delivery-photo-1");
    expect(stored.deliveredPhotos).toBeUndefined();
    expect(stored.servedVariant).toBe("single_v1");
    expect(stored.servedCount).toBe(1);
    expect(stored.fallbackReason).toBe("client_persistence_filter");
    expect(markEveningDeliveryKept(DELIVERY_DAY, DELIVERED_AT + 1)).toBe(true);
  });

  test("expires an unresolved four-photo bundle at 5am without saving or notice", () => {
    seedTarget();
    expect(
      setEveningDeliveredPhotos(
        DELIVERY_DAY,
        createDeliveredPhotos(4),
        DELIVERED_AT,
        { deliveryBundleId: "bundle-system", servedCount: 4 },
      ),
    ).toBe(true);

    expect(autoOpenExpiredEveningDeliveries(AUTO_OPEN_AT)).toBe(true);

    const stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored.deliveredPhoto).toBeUndefined();
    expect(stored.deliveredPhotos).toBeUndefined();
    expect(stored).toMatchObject({
      skippedAt: AUTO_OPEN_AT,
    });
    expect(stored.selectedPhotoId).toBeUndefined();
    expect(stored.openedAt).toBeUndefined();
    expect(stored.openedBy).toBeUndefined();
    expect(stored.keptAt).toBeUndefined();
    const keptPhotos = JSON.parse(
      window.localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]",
    ) as ExchangePhoto[];
    expect(keptPhotos).toEqual([]);
    expect(getSystemOpenedEveningDeliveryNotice(AUTO_OPEN_AT)).toBeNull();
    expect(autoOpenExpiredEveningDeliveries(AUTO_OPEN_AT + 1)).toBe(false);
  });

  test("expires a draft selection at 5am instead of treating it as saved", () => {
    seedTarget();
    expect(
      setEveningDeliveredPhotos(DELIVERY_DAY, createDeliveredPhotos(4), DELIVERED_AT, {
        deliveryBundleId: "bundle-system-with-draft",
        servedCount: 4,
      }),
    ).toBe(true);
    expect(
      setEveningDeliveryDraftSelection(DELIVERY_DAY, "delivery-photo-3"),
    ).toBe(true);

    expect(autoOpenExpiredEveningDeliveries(AUTO_OPEN_AT)).toBe(true);

    const stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored).toMatchObject({
      skippedAt: AUTO_OPEN_AT,
    });
    expect(stored.deliveredPhoto).toBeUndefined();
    expect(stored.deliveredPhotos).toBeUndefined();
    expect(stored.draftSelectedPhotoId).toBeUndefined();
    expect(stored.selectedPhotoId).toBeUndefined();
    expect(stored.openedAt).toBeUndefined();
    expect(stored.keptAt).toBeUndefined();
    const keptPhotos = JSON.parse(
      window.localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]",
    ) as ExchangePhoto[];
    expect(keptPhotos).toEqual([]);
    expect(getSystemOpenedEveningDeliveryNotice(AUTO_OPEN_AT)).toBeNull();
  });

  test("resolves without saving when every candidate was reported", () => {
    seedTarget();
    const photos = createDeliveredPhotos(4);
    expect(
      setEveningDeliveredPhotos(DELIVERY_DAY, photos, DELIVERED_AT, {
        deliveryBundleId: "bundle-system-all-reported",
        servedCount: 4,
      }),
    ).toBe(true);
    for (const photo of photos) {
      reportExchangePhoto(photo, "not_cat");
    }

    expect(autoOpenExpiredEveningDeliveries(AUTO_OPEN_AT)).toBe(true);

    const stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored).toMatchObject({
      skippedAt: AUTO_OPEN_AT,
    });
    expect(stored.deliveredPhoto).toBeUndefined();
    expect(stored.deliveredPhotos).toBeUndefined();
    expect(stored.selectedPhotoId).toBeUndefined();
    expect(stored.openedAt).toBeUndefined();
    expect(stored.openedBy).toBeUndefined();
    expect(stored.keptAt).toBeUndefined();
    expect(
      JSON.parse(
        window.localStorage.getItem("nyaruhodo_exchange_kept_photos") ?? "[]",
      ),
    ).toEqual([]);
    expect(getSystemOpenedEveningDeliveryNotice(AUTO_OPEN_AT)).toBeNull();
    expect(autoOpenExpiredEveningDeliveries(AUTO_OPEN_AT + 1)).toBe(false);
  });

  test("updates one candidate data URL and keeps the two-argument path", () => {
    seedTarget();
    expect(
      setEveningDeliveredPhotos(
        DELIVERY_DAY,
        createDeliveredPhotos(4),
        DELIVERED_AT,
      ),
    ).toBe(true);

    const thirdDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    expect(
      updateEveningDeliveredPhotoDataUrl(
        DELIVERY_DAY,
        thirdDataUrl,
        "delivery-photo-3",
      )?.offlineSrc,
    ).toBe(thirdDataUrl);
    let stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored.deliveredPhoto?.offlineSrc).toBeUndefined();
    expect(stored.deliveredPhotos?.[2].offlineSrc).toBe(thirdDataUrl);

    const firstDataUrl = `${thirdDataUrl}AAAA`;
    expect(
      updateEveningDeliveredPhotoDataUrl(DELIVERY_DAY, firstDataUrl)?.offlineSrc,
    ).toBe(firstDataUrl);
    stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored.deliveredPhoto?.offlineSrc).toBe(firstDataUrl);
    expect(stored.deliveredPhotos?.[0].offlineSrc).toBe(firstDataUrl);
  });

  test("keeps the legacy single-photo state compatible", () => {
    seedTarget();
    const [photo] = createDeliveredPhotos(1);
    expect(setEveningDeliveredPhoto(DELIVERY_DAY, photo, DELIVERED_AT)).toBe(true);

    let stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored.deliveredPhotos).toBeUndefined();
    expect(markEveningDeliveryKept(DELIVERY_DAY, DELIVERED_AT + 1)).toBe(true);
    stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored).toMatchObject({
      deliveredPhoto: { id: "delivery-photo-1" },
      openedBy: "user",
      openedAt: DELIVERED_AT + 1,
      keptAt: DELIVERED_AT + 1,
    });
    expect(stored.selectedPhotoId).toBeUndefined();
  });

  test("still system-opens an expired legacy single-photo delivery", () => {
    seedTarget();
    const [photo] = createDeliveredPhotos(1);
    expect(setEveningDeliveredPhoto(DELIVERY_DAY, photo, DELIVERED_AT)).toBe(true);

    expect(autoOpenExpiredEveningDeliveries(AUTO_OPEN_AT)).toBe(true);

    const stored = readEveningDeliveryStore()[DELIVERY_DAY];
    expect(stored).toMatchObject({
      deliveredPhoto: { id: "delivery-photo-1" },
      openedAt: AUTO_OPEN_AT,
      openedBy: "system",
    });
    expect(stored.skippedAt).toBeUndefined();
    expect(stored.keptAt).toBeUndefined();
    expect(getSystemOpenedEveningDeliveryNotice(AUTO_OPEN_AT)).toMatchObject({
      dateKey: DELIVERY_DAY,
      deliveredPhoto: { id: "delivery-photo-1" },
    });
  });
});

function createOnboardingPhoto(createdAt: number): OwnSleepingPhoto {
  return {
    id: "onboarding-boundary-photo",
    catId: "boundary-cat",
    ownerCatId: "boundary-cat",
    src: "data:image/png;base64,AA==",
    state: "sleeping",
    visibility: "shared",
    deliveryStatus: "available",
    triggerLabel: "ねがお",
    theme: "sleeping",
    shared: true,
    createdAt,
    captureContext: "onboarding",
  };
}

function seedTarget() {
  expect(
    writeEveningDeliveryStore({
      [DELIVERY_DAY]: {
        dateKey: DELIVERY_DAY,
        targetOwnPhotoId: "own-photo",
        targetCatId: "cat-1",
        targetCapturedAt: DELIVERED_AT - 60_000,
      },
    }),
  ).toBe(true);
}

function createDeliveredPhotos(count: number): ExchangePhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `delivery-photo-${index + 1}`,
    sourcePhotoId: `source-photo-${index + 1}`,
    src: `storage:admin-stock/sleeping/delivery-photo-${index + 1}.jpg`,
    title: "とどいたねがお",
    subtitle: "",
    triggerLabel: "sleeping",
    theme: "sleeping",
    deliveredAt: DELIVERED_AT,
  }));
}

function installMemoryWindow() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
  const memoryWindow = {
    localStorage,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: memoryWindow,
  });

  return () => {
    if (previous) {
      Object.defineProperty(globalThis, "window", previous);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  };
}
