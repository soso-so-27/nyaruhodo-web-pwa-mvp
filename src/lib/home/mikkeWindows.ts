import { STORAGE_KEYS } from "../storage";

export type MikkeWindowCategory = "place" | "pose" | "sign";

export type MikkeWindowOption = {
  id: string;
  label: string;
  collectionSlotId?: string;
};

export type MikkeWindowQuestion = {
  id: string;
  category: MikkeWindowCategory;
  categoryLabel: string;
  prompt: string;
  surfaceText: string;
  resultLead: string;
  options: MikkeWindowOption[];
  windowOptionIds: string[];
};

export type MikkeWindow = {
  id: string;
  startsAt: number;
  endsAt: number;
  question: MikkeWindowQuestion;
};

export type StoredMikkeWindowAnswer = {
  windowId: string;
  questionId: string;
  category: MikkeWindowCategory;
  answerId: string;
  answerLabel: string;
  answeredAt: number;
};

export type MikkeWindowCount = {
  answerId: string;
  answerLabel: string;
  count: number;
};

export type MikkeWindowResult = {
  counts: Array<MikkeWindowCount & { ratio: number }>;
  displayTotal: number;
  realTotal: number;
  isMockAssisted: boolean;
};

const HOUR_MS = 60 * 60 * 1000;
const MIN_DISPLAY_TOTAL = 18;

export const MIKKE_WINDOW_QUESTIONS: MikkeWindowQuestion[] = [
  {
    id: "place-now",
    category: "place",
    categoryLabel: "いばしょ",
    prompt: "いま、どこにいる？",
    surfaceText: "いばしょ",
    resultLead: "ほかの子たちは",
    options: [
      { id: "window", label: "窓辺", collectionSlotId: "by-window" },
      { id: "bed", label: "寝床", collectionSlotId: "in-futon" },
      { id: "high-place", label: "高いところ", collectionSlotId: "high-place" },
      { id: "hideout", label: "隠れ場所" },
      { id: "nearby", label: "近く" },
      { id: "box-bag", label: "もぐりこみ", collectionSlotId: "in-box" },
      { id: "sunny", label: "ひなた", collectionSlotId: "sunbathing" },
      { id: "food-water", label: "ごはん場" },
      { id: "sofa-cushion", label: "ソファ" },
      { id: "floor-rug", label: "床・ラグ" },
      { id: "doorway", label: "ドア前", collectionSlotId: "welcome-home" },
      { id: "water-area", label: "水まわり" },
    ],
    windowOptionIds: [
      "window",
      "bed",
      "high-place",
      "hideout",
      "nearby",
      "box-bag",
    ],
  },
  {
    id: "pose-now",
    category: "pose",
    categoryLabel: "すがた",
    prompt: "いま、どんな姿？",
    surfaceText: "すがた",
    resultLead: "ほかの子たちは",
    options: [
      { id: "loaf", label: "ちょこん寝", collectionSlotId: "loaf" },
      { id: "curled-up", label: "まるまり", collectionSlotId: "curled-up" },
      { id: "stretch", label: "のびー", collectionSlotId: "stretch" },
      { id: "belly-up", label: "へそ天", collectionSlotId: "belly-up" },
      {
        id: "face-down-sleep",
        label: "ごめん寝",
        collectionSlotId: "face-down-sleep",
      },
      { id: "sitting", label: "おすわり", collectionSlotId: "sitting" },
      { id: "grooming", label: "毛づくろい" },
      { id: "tail-up", label: "しっぽピーン", collectionSlotId: "tail-up" },
      {
        id: "hidden-paws",
        label: "おててないない",
        collectionSlotId: "hidden-paws",
      },
      { id: "liquid", label: "液体化", collectionSlotId: "liquid" },
      { id: "side-sleep", label: "横寝" },
      { id: "weird-sleep", label: "変な寝相", collectionSlotId: "weird-sleep" },
      { id: "standing", label: "立ってる" },
      { id: "crouching", label: "低い姿勢" },
    ],
    windowOptionIds: [
      "loaf",
      "curled-up",
      "stretch",
      "belly-up",
      "sitting",
      "grooming",
    ],
  },
  {
    id: "sign-now",
    category: "sign",
    categoryLabel: "サイン",
    prompt: "いま、どんなサイン？",
    surfaceText: "サイン",
    resultLead: "ほかの子たちは",
    options: [
      { id: "waiting-food", label: "ごはん待ち" },
      { id: "waiting-play", label: "遊び待ち" },
      { id: "near-owner", label: "そばにいる" },
      { id: "solo-time", label: "ひとり時間" },
      { id: "following", label: "ついてくる" },
      { id: "meowing", label: "鳴いてる" },
      { id: "purring", label: "ゴロゴロ" },
      { id: "kneading", label: "ふみふみ" },
      { id: "rubbing", label: "すりすり" },
      { id: "watching", label: "見ている" },
      { id: "welcome-home", label: "お出迎え", collectionSlotId: "welcome-home" },
      { id: "calling", label: "呼びにくる" },
      { id: "sniffing", label: "におい確認" },
      { id: "needs-space", label: "そっとして" },
      { id: "prey-watch", label: "狙ってる" },
      { id: "scratching", label: "爪とぎ" },
    ],
    windowOptionIds: [
      "waiting-food",
      "waiting-play",
      "near-owner",
      "solo-time",
      "meowing",
      "purring",
    ],
  },
];

export function getCurrentMikkeWindow(now = Date.now()): MikkeWindow {
  const startsAt = Math.floor(now / HOUR_MS) * HOUR_MS;
  const windowNumber = Math.floor(startsAt / HOUR_MS);
  const question =
    MIKKE_WINDOW_QUESTIONS[windowNumber % MIKKE_WINDOW_QUESTIONS.length];

  return {
    id: `${question.id}-${new Date(startsAt).toISOString().slice(0, 13)}`,
    startsAt,
    endsAt: startsAt + HOUR_MS,
    question,
  };
}

export function getMikkeWindowOption(
  question: MikkeWindowQuestion,
  answerId: string,
) {
  return question.options.find((option) => option.id === answerId) ?? null;
}

export function getMikkeWindowOptions(question: MikkeWindowQuestion) {
  const optionById = new Map(question.options.map((option) => [option.id, option]));

  return question.windowOptionIds
    .map((id) => optionById.get(id))
    .filter((option): option is MikkeWindowOption => Boolean(option));
}

export function readStoredMikkeWindowAnswer(
  catId: string,
  windowId: string,
): StoredMikkeWindowAnswer | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getMikkeWindowAnswerKey(catId));
    if (!raw) return null;
    const answers = JSON.parse(raw) as Record<string, StoredMikkeWindowAnswer>;
    return answers[windowId] ?? null;
  } catch {
    return null;
  }
}

export function saveStoredMikkeWindowAnswer(
  catId: string,
  answer: StoredMikkeWindowAnswer,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getMikkeWindowAnswerKey(catId);
    const raw = window.localStorage.getItem(key);
    const answers = raw
      ? (JSON.parse(raw) as Record<string, StoredMikkeWindowAnswer>)
      : {};
    answers[answer.windowId] = answer;
    window.localStorage.setItem(key, JSON.stringify(answers));
  } catch {
    // The local record still carries the answer, so this should not block input.
  }
}

export function buildMikkeWindowResult(
  question: MikkeWindowQuestion,
  actualCounts: MikkeWindowCount[],
  windowId: string,
): MikkeWindowResult {
  const windowOptions = getMikkeWindowOptions(question);
  const actualByAnswer = new Map(
    actualCounts.map((count) => [count.answerId, count.count]),
  );
  const realTotal = actualCounts.reduce((total, count) => total + count.count, 0);
  const isMockAssisted = realTotal < MIN_DISPLAY_TOTAL;
  const mockCounts = isMockAssisted ? buildMockCounts(question, windowId) : [];
  const mockByAnswer = new Map(
    mockCounts.map((count) => [count.answerId, count.count]),
  );
  const counts = windowOptions.map((option) => {
    const count =
      (actualByAnswer.get(option.id) ?? 0) +
      (isMockAssisted ? mockByAnswer.get(option.id) ?? 0 : 0);
    return {
      answerId: option.id,
      answerLabel: option.label,
      count,
    };
  });
  const displayTotal = Math.max(
    1,
    counts.reduce((total, count) => total + count.count, 0),
  );

  return {
    counts: counts
      .map((count) => ({
        ...count,
        ratio: Math.round((count.count / displayTotal) * 100),
      }))
      .sort((a, b) => b.count - a.count),
    displayTotal,
    realTotal,
    isMockAssisted,
  };
}

function buildMockCounts(
  question: MikkeWindowQuestion,
  windowId: string,
): MikkeWindowCount[] {
  const seed = hashString(`${windowId}:${question.id}`);
  const windowOptions = getMikkeWindowOptions(question);
  const total = MIN_DISPLAY_TOTAL + (seed % 9);
  const weights = windowOptions.map((option, index) => {
    const base = 8 + ((seed >> (index * 3)) % 8);
    const categoryAdjustment =
      question.category === "pose" && option.id === "loaf"
        ? 3
        : question.category === "place" && option.id === "bed"
          ? 2
          : question.category === "sign" && option.id === "solo-time"
            ? 2
            : 0;
    return base + categoryAdjustment;
  });
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let remaining = total;

  return windowOptions.map((option, index) => {
    const isLast = index === windowOptions.length - 1;
    const count = isLast
      ? remaining
      : Math.max(1, Math.round((weights[index] / weightTotal) * total));
    remaining -= count;
    return {
      answerId: option.id,
      answerLabel: option.label,
      count,
    };
  });
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getMikkeWindowAnswerKey(catId: string) {
  return `${STORAGE_KEYS.activeCatId}_mikke_window_answers_${catId}`;
}
