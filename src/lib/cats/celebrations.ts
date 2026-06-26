export type CatCelebrationItem = {
  key: "family-days" | "sleeping-count" | "birthday";
  label: string;
  status: string;
  reached: boolean;
};

export type CatCelebrationInput = {
  familyDuration: { primary: string; secondary: string };
  birthdayStatus: { copy: string; isToday: boolean } | null;
  takenSleepingPhotoCount: number;
};

const SLEEPING_COUNT_TARGETS = [1, 10, 50, 100, 365, 500, 1000] as const;

export function createCatCelebrationItems({
  familyDuration,
  birthdayStatus,
  takenSleepingPhotoCount,
}: CatCelebrationInput): CatCelebrationItem[] {
  return [
    createFamilyCelebration(familyDuration),
    createSleepingCountCelebration(takenSleepingPhotoCount),
    createBirthdayCelebration(birthdayStatus),
  ];
}

function createFamilyCelebration(
  familyDuration: CatCelebrationInput["familyDuration"],
): CatCelebrationItem {
  const familyCopy =
    familyDuration.secondary ||
    (familyDuration.primary === "未設定" ? "未登録" : familyDuration.primary);

  return {
    key: "family-days",
    label: "家族になって",
    status: familyCopy,
    reached: familyCopy !== "未登録",
  };
}

function createSleepingCountCelebration(
  takenSleepingPhotoCount: number,
): CatCelebrationItem {
  const count = Math.max(0, Math.floor(takenSleepingPhotoCount));
  const nextTarget = SLEEPING_COUNT_TARGETS.find((target) => target > count);

  if (count <= 0) {
    return {
      key: "sleeping-count",
      label: "ねがお",
      status: "これから",
      reached: false,
    };
  }

  if (!nextTarget) {
    return {
      key: "sleeping-count",
      label: "ねがお",
      status: `${count}枚`,
      reached: true,
    };
  }

  const reachedTarget = [...SLEEPING_COUNT_TARGETS]
    .reverse()
    .find((target) => target <= count);
  const primary = reachedTarget ? `${reachedTarget}枚` : `${count}枚`;

  return {
    key: "sleeping-count",
    label: "ねがお",
    status: `${primary} → ${nextTarget}枚`,
    reached: Boolean(reachedTarget),
  };
}

function createBirthdayCelebration(
  birthdayStatus: CatCelebrationInput["birthdayStatus"],
): CatCelebrationItem {
  if (!birthdayStatus) {
    return {
      key: "birthday",
      label: "誕生日",
      status: "未登録",
      reached: false,
    };
  }

  return {
    key: "birthday",
    label: "誕生日",
    status: birthdayStatus.copy.replace("誕生日まで ", ""),
    reached: birthdayStatus.isToday,
  };
}
