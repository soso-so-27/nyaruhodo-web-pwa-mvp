export type CatCelebrationTone =
  | "unset"
  | "active"
  | "progress"
  | "upcoming"
  | "today"
  | "recent";

export type CatCelebrationItem = {
  key: "family-days" | "sleeping-count" | "birthday";
  label: string;
  status: string;
  reached: boolean;
  tone: CatCelebrationTone;
};

export type CatCelebrationInput = {
  familyDuration: { primary: string; secondary: string };
  birthdayStatus: {
    copy: string;
    isToday: boolean;
    phase?: "normal" | "upcoming" | "today" | "recent";
  } | null;
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
    tone: familyCopy === "未登録" ? "unset" : "active",
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
      tone: "unset",
    };
  }

  if (!nextTarget) {
    return {
      key: "sleeping-count",
      label: "ねがお",
      status: `${count}枚`,
      reached: true,
      tone: "progress",
    };
  }

  const reachedTarget = [...SLEEPING_COUNT_TARGETS]
    .reverse()
    .find((target) => target <= count);
  const primary = reachedTarget ?? count;

  return {
    key: "sleeping-count",
    label: "ねがお",
    status: `${primary} / ${nextTarget}枚`,
    reached: Boolean(reachedTarget),
    tone: "progress",
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
      tone: "unset",
    };
  }

  const tone: CatCelebrationTone =
    birthdayStatus.phase === "today"
      ? "today"
      : birthdayStatus.phase === "recent"
        ? "recent"
        : birthdayStatus.phase === "upcoming"
          ? "upcoming"
          : "active";

  return {
    key: "birthday",
    label: "誕生日",
    status: birthdayStatus.copy.replace("誕生日まで ", ""),
    reached: birthdayStatus.isToday,
    tone,
  };
}
