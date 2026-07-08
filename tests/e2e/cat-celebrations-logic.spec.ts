import { expect, test } from "@playwright/test";

import { createCatCelebrationItems } from "../../src/lib/cats/celebrations";

test.describe("cat celebrations", () => {
  test("keeps an empty sleeping count as a quiet starting state", () => {
    const items = createCatCelebrationItems({
      familyDuration: { primary: "未設定", secondary: "" },
      birthdayStatus: null,
      takenSleepingPhotoCount: 0,
    });

    expect(items).toEqual([
      {
        key: "family-days",
        label: "家族になって",
        status: "未登録",
        reached: false,
        tone: "unset",
      },
      {
        key: "sleeping-count",
        label: "ねがお",
        status: "これから",
        reached: false,
        tone: "unset",
      },
      {
        key: "birthday",
        label: "誕生日",
        status: "未登録",
        reached: false,
        tone: "unset",
      },
    ]);
  });

  test("shows the sleeping photo count without a target denominator", () => {
    expect(
      createCatCelebrationItems({
        familyDuration: { primary: "100日", secondary: "" },
        birthdayStatus: null,
        takenSleepingPhotoCount: 10,
      })[1],
    ).toMatchObject({
      label: "ねがお",
      status: "10枚",
      reached: true,
    });

    expect(
      createCatCelebrationItems({
        familyDuration: { primary: "100日", secondary: "" },
        birthdayStatus: null,
        takenSleepingPhotoCount: 80,
      })[1],
    ).toMatchObject({
      status: "80枚",
      reached: true,
    });
  });

  test("keeps long-term counts useful after the early milestones", () => {
    expect(
      createCatCelebrationItems({
        familyDuration: { primary: "1000日", secondary: "2年と270日" },
        birthdayStatus: null,
        takenSleepingPhotoCount: 420,
      })[1],
    ).toMatchObject({
      status: "420枚",
      reached: true,
    });
  });

  test("separates birthday status from the count and family cards", () => {
    const items = createCatCelebrationItems({
      familyDuration: { primary: "100日", secondary: "" },
      birthdayStatus: { copy: "きょうは 誕生日", isToday: true },
      takenSleepingPhotoCount: 12,
    });

    expect(items[2]).toMatchObject({
      label: "誕生日",
      status: "きょうは 誕生日",
      reached: true,
    });
  });
});
