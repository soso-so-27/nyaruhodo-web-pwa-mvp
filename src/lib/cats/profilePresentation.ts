import type {
  CatBasicInfo,
  CatPersonalityInfo,
  CatProfile,
} from "../../components/home/homeInputHelpers";

const PERSONALITY_VALUE_MAX_LENGTH = 60;
const CAT_NAME_MAX_LENGTH = 40;
const LIVING_VALUE_MAX_LENGTH = 180;
const LIVING_NOTE_MAX_LENGTH = 100;

const PERSONALITY_QUESTIONS = [
  {
    key: "callName",
    label: "呼び名",
    prompt: "いつもの呼び名は？",
  },
  {
    key: "favoritePlace",
    label: "好きな場所",
    prompt: "好きな場所は？",
  },
  {
    key: "favoritePlay",
    label: "好きな遊び",
    prompt: "好きな遊びは？",
  },
  {
    key: "favoriteTouch",
    label: "なでると喜ぶ場所",
    prompt: "なでると喜ぶ場所は？",
  },
  {
    key: "dislikes",
    label: "苦手なこと",
    prompt: "苦手なことは？",
  },
] as const satisfies ReadonlyArray<{
  key: keyof CatPersonalityInfo;
  label: string;
  prompt: string;
}>;

const COAT_LABELS: Readonly<Record<string, string>> = {
  saba: "サバトラ",
  cream: "サバトラ",
  kiji_tabby: "キジトラ",
  gray: "グレー",
  orange_tabby: "茶トラ",
  black: "黒",
  white: "白",
  hachiware: "ハチワレ",
  calico: "三毛",
  tortoiseshell: "サビ",
};

export type CatProfilePersonalityQuestionKey =
  (typeof PERSONALITY_QUESTIONS)[number]["key"];

export type CatProfileNextQuestion =
  | {
      kind: "question";
      key: CatProfilePersonalityQuestionKey;
      label: string;
      prompt: string;
    }
  | {
      kind: "review";
      key: "review";
      label: "見返す";
      prompt: "書いたことを、見返してみる";
    };

export type CatProfileLivingItemGroup = "care" | "history" | "identity";

export type CatProfileLivingItemKey =
  | "careNote"
  | "vetClinic"
  | "vaccine"
  | "weight"
  | "familySinceDate"
  | "birthDate"
  | "gender"
  | "coat"
  | "breed";

export type CatProfileLivingItem = {
  key: CatProfileLivingItemKey;
  group: CatProfileLivingItemGroup;
  label: string;
  value: string;
  note?: string;
  valueTone?: "text" | "date" | "measurement";
};

export type CatProfilePresentation = {
  title: string;
  portraitLines: string[];
  portraitParagraph: string;
  nextQuestion: CatProfileNextQuestion;
  livingItems: CatProfileLivingItem[];
};

/**
 * CatProfile を、プロフィール画面がそのまま描画できる小さな view-model にする。
 * 保存値は変更せず、空白・改行・極端に長い旧データだけを表示用に整える。
 */
export function buildCatProfilePresentation(
  profile: CatProfile,
): CatProfilePresentation {
  const portraitLines = buildCatProfilePortraitLines(profile);

  return {
    title: buildCatProfilePortraitTitle(profile),
    portraitLines,
    portraitParagraph: portraitLines.join(""),
    nextQuestion: getNextCatProfileQuestion(profile),
    livingItems: buildCatProfileLivingItems(profile),
  };
}

export function buildCatProfilePortraitTitle(profile: CatProfile): string {
  const name =
    profile.nameState === "unset"
      ? null
      : normalizeDisplayText(profile.name, CAT_NAME_MAX_LENGTH);

  return `${name ?? "この子"}は、こんな子`;
}

export function buildCatProfilePortraitLines(profile: CatProfile): string[] {
  const personality = profile.basicInfo?.personality;

  if (!personality) {
    return [];
  }

  const values = {
    callName: normalizeDisplayText(
      personality.callName,
      PERSONALITY_VALUE_MAX_LENGTH,
    ),
    favoritePlace: normalizeDisplayText(
      personality.favoritePlace,
      PERSONALITY_VALUE_MAX_LENGTH,
    ),
    favoritePlay: normalizeDisplayText(
      personality.favoritePlay,
      PERSONALITY_VALUE_MAX_LENGTH,
    ),
    favoriteTouch: normalizeDisplayText(
      personality.favoriteTouch,
      PERSONALITY_VALUE_MAX_LENGTH,
    ),
    dislikes: normalizeDisplayText(
      personality.dislikes,
      PERSONALITY_VALUE_MAX_LENGTH,
    ),
  };

  return [
    values.callName ? `ふだんの呼び名は、${values.callName}。` : null,
    values.favoritePlace ? `よくいるのは、${values.favoritePlace}。` : null,
    values.favoritePlay ? `好きな遊びは、${values.favoritePlay}。` : null,
    values.favoriteTouch
      ? `なでると喜ぶのは、${values.favoriteTouch}。`
      : null,
    values.dislikes ? `苦手なのは、${values.dislikes}。` : null,
  ].filter((line): line is string => line !== null);
}

export function getNextCatProfileQuestion(
  profile: CatProfile,
): CatProfileNextQuestion {
  const personality = profile.basicInfo?.personality;
  const unanswered = PERSONALITY_QUESTIONS.find(
    ({ key }) => !normalizeDisplayText(personality?.[key]),
  );

  if (unanswered) {
    return {
      kind: "question",
      key: unanswered.key,
      label: unanswered.label,
      prompt: unanswered.prompt,
    };
  }

  return {
    kind: "review",
    key: "review",
    label: "見返す",
    prompt: "書いたことを、見返してみる",
  };
}

/**
 * 性格項目は含めず、引き継ぎや日々のケアで役立つ情報を先に返す。
 */
export function buildCatProfileLivingItems(
  profile: CatProfile,
): CatProfileLivingItem[] {
  const basicInfo = profile.basicInfo;
  const care = basicInfo?.care;
  const items: CatProfileLivingItem[] = [];

  pushLivingItem(items, {
    key: "careNote",
    group: "care",
    label: "気をつけること",
    value: normalizeDisplayText(care?.careNote, LIVING_VALUE_MAX_LENGTH),
  });

  pushLivingItem(items, {
    key: "vetClinic",
    group: "care",
    label: "かかりつけ",
    value: normalizeDisplayText(care?.vetClinic, LIVING_VALUE_MAX_LENGTH),
  });

  const vaccineDate = formatLocalDate(care?.vaccineDate);
  const vaccineNote = normalizeDisplayText(
    care?.vaccineNote,
    LIVING_NOTE_MAX_LENGTH,
  );

  if (vaccineDate || vaccineNote) {
    items.push({
      key: "vaccine",
      group: "care",
      label: "ワクチン",
      value: vaccineDate ?? vaccineNote ?? "",
      note: vaccineDate ? vaccineNote ?? undefined : undefined,
      valueTone: vaccineDate ? "date" : "text",
    });
  }

  const weight = formatWeight(care?.weightKg);

  pushLivingItem(items, {
    key: "weight",
    group: "care",
    label: "体重",
    value: weight,
    note: weight ? formatMeasuredDate(care?.weightMeasuredDate) : undefined,
    valueTone: "measurement",
  });

  pushLivingItem(items, {
    key: "familySinceDate",
    group: "history",
    label: "家族になった日",
    value: formatLocalDate(basicInfo?.familySinceDate),
    valueTone: "date",
  });

  pushLivingItem(items, {
    key: "birthDate",
    group: "history",
    label: "誕生日",
    value: formatLocalDate(basicInfo?.birthDate),
    valueTone: "date",
  });

  pushLivingItem(items, {
    key: "gender",
    group: "identity",
    label: "性別",
    value: formatGender(basicInfo?.gender),
  });

  const coat = normalizeDisplayText(
    profile.appearance?.coat,
    LIVING_VALUE_MAX_LENGTH,
  );

  pushLivingItem(items, {
    key: "coat",
    group: "identity",
    label: "毛柄",
    value: coat ? COAT_LABELS[coat] ?? coat : null,
  });

  pushLivingItem(items, {
    key: "breed",
    group: "identity",
    label: "猫種",
    value: normalizeDisplayText(basicInfo?.breed, LIVING_VALUE_MAX_LENGTH),
  });

  return items;
}

function pushLivingItem(
  items: CatProfileLivingItem[],
  item: Omit<CatProfileLivingItem, "value"> & {
    value: string | null | undefined;
  },
) {
  if (!item.value) {
    return;
  }

  items.push({
    ...item,
    value: item.value,
    note: item.note || undefined,
  });
}

function normalizeDisplayText(
  value: string | undefined,
  maxLength = LIVING_VALUE_MAX_LENGTH,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/gu, " ").trim();

  if (!normalized) {
    return null;
  }

  const characters = Array.from(normalized);

  if (characters.length <= maxLength) {
    return normalized;
  }

  return `${characters.slice(0, Math.max(1, maxLength - 1)).join("")}…`;
}

function formatLocalDate(value: string | undefined): string | null {
  const normalized = normalizeDisplayText(value);
  const match = normalized?.match(/^(\d{4})-(\d{2})-(\d{2})$/u);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}年${month}月${day}日`;
}

function formatMeasuredDate(value: string | undefined): string | undefined {
  const date = formatLocalDate(value);

  return date ? `${date}に測定` : undefined;
}

function formatWeight(value: number | undefined): string | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0.5 ||
    value > 20
  ) {
    return null;
  }

  const rounded = Math.round(value * 10) / 10;
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);

  return `${formatted} kg`;
}

function formatGender(
  value: CatBasicInfo["gender"],
): string | null {
  if (value === "male") {
    return "男の子";
  }

  if (value === "female") {
    return "女の子";
  }

  if (value === "unknown") {
    return "わからない";
  }

  return null;
}
