import { expect, test } from "@playwright/test";

import {
  getEveningDeliveryTargetDateKey,
  getJstDateKey,
  recordOnboardingEveningDeliveryTarget,
} from "../../src/lib/home/eveningDelivery";
import type { OwnSleepingPhoto } from "../../src/lib/home/sleepingPhotos";
import {
  getServerJstDateKey,
  validateServerDeliveryDateKey,
} from "../../src/lib/home/eveningDeliveryServer";

const DELIVERY_DAY = "2026-07-10";

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
