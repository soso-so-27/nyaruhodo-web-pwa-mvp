import type {
  CatBasicInfo,
  CatPersonalityInfo,
  CatProfile,
} from "../../components/home/homeInputHelpers";

const PERSONALITY_VALUE_MAX_LENGTH = 60;
const LIVING_VALUE_MAX_LENGTH = 180;
const LIVING_NOTE_MAX_LENGTH = 100;

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

export type CatProfilePersonalityQuestionKey = keyof CatPersonalityInfo;

export type CatProfilePersonalityItemKey =
  | "callName"
  | "favoritePlace"
  | "favoritePlay"
  | "favoriteTouch"
  | "dislikes";

export type CatProfilePersonalityItem = {
  key: CatProfilePersonalityItemKey;
  label: string;
  value: string;
};

export type CatProfileLivingItemGroup = "living" | "health" | "basic";

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
  personalityItems: CatProfilePersonalityItem[];
  livingItems: CatProfileLivingItem[];
};

/**
 * CatProfile を、プロフィール画面がそのまま描画できる小さな view-model にする。
 * 保存値は変更せず、空白・改行・極端に長い旧データだけを表示用に整える。
 */
export function buildCatProfilePresentation(
  profile: CatProfile,
): CatProfilePresentation {
  return {
    personalityItems: buildCatProfilePersonalityItems(profile),
    livingItems: buildCatProfileLivingItems(profile),
  };
}

export function buildCatProfilePersonalityItems(
  profile: CatProfile,
): CatProfilePersonalityItem[] {
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

  const items: CatProfilePersonalityItem[] = [];

  if (values.callName) {
    items.push({
      key: "callName",
      label: "呼び名",
      value: values.callName,
    });
  }

  if (values.favoritePlace) {
    items.push({
      key: "favoritePlace",
      label: "好きな場所",
      value: values.favoritePlace,
    });
  }

  if (values.favoritePlay) {
    items.push({
      key: "favoritePlay",
      label: "好きな遊び",
      value: values.favoritePlay,
    });
  }

  if (values.favoriteTouch) {
    items.push({
      key: "favoriteTouch",
      label: "好きななで方",
      value: values.favoriteTouch,
    });
  }

  if (values.dislikes) {
    items.push({
      key: "dislikes",
      label: "苦手",
      value: values.dislikes,
    });
  }

  return items;
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
    group: "living",
    label: "気をつけること",
    value: normalizeDisplayText(care?.careNote, LIVING_VALUE_MAX_LENGTH),
  });

  const weight = formatWeight(care?.weightKg);

  pushLivingItem(items, {
    key: "weight",
    group: "health",
    label: "体重",
    value: weight,
    note: weight ? formatMeasuredDate(care?.weightMeasuredDate) : undefined,
    valueTone: "measurement",
  });

  pushLivingItem(items, {
    key: "vetClinic",
    group: "health",
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
      group: "health",
      label: "ワクチン",
      value: vaccineDate ?? vaccineNote ?? "",
      note: vaccineDate ? vaccineNote ?? undefined : undefined,
      valueTone: vaccineDate ? "date" : "text",
    });
  }

  pushLivingItem(items, {
    key: "familySinceDate",
    group: "basic",
    label: "家族になった日",
    value: formatLocalDate(basicInfo?.familySinceDate),
    valueTone: "date",
  });

  pushLivingItem(items, {
    key: "birthDate",
    group: "basic",
    label: "誕生日",
    value: formatLocalDate(basicInfo?.birthDate),
    valueTone: "date",
  });

  pushLivingItem(items, {
    key: "gender",
    group: "basic",
    label: "性別",
    value: formatGender(basicInfo?.gender),
  });

  const coat = normalizeDisplayText(
    profile.appearance?.coat,
    LIVING_VALUE_MAX_LENGTH,
  );

  pushLivingItem(items, {
    key: "coat",
    group: "basic",
    label: "毛柄",
    value: coat ? COAT_LABELS[coat] ?? coat : null,
  });

  pushLivingItem(items, {
    key: "breed",
    group: "basic",
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
