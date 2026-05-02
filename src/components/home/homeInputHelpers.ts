import type { RecentEvent } from "../../lib/supabase/queries";

export type LatestHypothesisView = {
  input: string;
  context: Record<string, unknown>;
  category: string;
  text?: string;
  source?: string;
  diagnosisId?: string | null;
};

export type CatProfile = {
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ConcernSignal =
  | "meowing"
  | "following"
  | "restless"
  | "low_energy"
  | "fighting"
  | "unknown";

export const CATEGORY_MESSAGES: Record<string, string> = {
  food: "\u3054\u98ef\u304b\u3082\u3057\u308c\u307e\u305b\u3093",
  play: "\u904a\u3073\u305f\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
  social: "\u304b\u307e\u3063\u3066\u307b\u3057\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
  stress: "\u5c11\u3057\u843d\u3061\u7740\u304d\u305f\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
  health: "\u4f53\u8abf\u3092\u898b\u3066\u3042\u3052\u305f\u65b9\u304c\u3088\u3055\u305d\u3046\u3067\u3059",
};

export const HYPOTHESIS_CTA_LABELS: Record<
  string,
  {
    main: string;
    sub: string;
  }
> = {
  food: {
    main: "\u3054\u306f\u3093\u3092\u78ba\u8a8d\u3057\u305f",
    sub: "\u307e\u3060\u69d8\u5b50\u3092\u898b\u308b",
  },
  play: {
    main: "\u904a\u3093\u3067\u307f\u305f",
    sub: "\u307e\u3060\u69d8\u5b50\u3092\u898b\u308b",
  },
  social: {
    main: "\u304b\u307e\u3063\u3066\u307f\u305f",
    sub: "\u307e\u3060\u69d8\u5b50\u3092\u898b\u308b",
  },
  stress: {
    main: "\u843d\u3061\u7740\u3051\u308b\u3088\u3046\u306b\u3057\u305f",
    sub: "\u307e\u3060\u69d8\u5b50\u3092\u898b\u308b",
  },
  health: {
    main: "\u4f53\u8abf\u3092\u78ba\u8a8d\u3057\u305f",
    sub: "\u8a18\u9332\u3060\u3051\u3059\u308b",
  },
};

export const FALLBACK_HYPOTHESIS_CTA_LABELS = {
  main: "\u69d8\u5b50\u3092\u8a18\u9332\u3059\u308b",
  sub: "\u9589\u3058\u308b",
};

const GUIDANCE_BY_UNDERSTANDING = [
  {
    max: 30,
    title: "\u307e\u305a\u306f\u3001\u4eca\u65e5\u306e\u69d8\u5b50\u3092\u6559\u3048\u3066\u304f\u3060\u3055\u3044",
    text: "\u5c11\u3057\u305a\u3064\u3001\u3053\u306e\u5b50\u306e\u50be\u5411\u304c\u898b\u3048\u3066\u304d\u307e\u3059",
  },
  {
    max: 70,
    title: "\u5c11\u3057\u305a\u3064\u3001\u50be\u5411\u304c\u898b\u3048\u3066\u304d\u307e\u3057\u305f",
    text: "\u6c17\u306b\u306a\u308b\u69d8\u5b50\u304c\u3042\u308c\u3070\u3001\u8fd1\u3044\u3082\u306e\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044",
  },
  {
    max: 100,
    title: "\u6700\u8fd1\u306e\u69d8\u5b50\u304b\u3089\u3001\u5148\u306b\u5019\u88dc\u3092\u51fa\u305b\u305d\u3046\u3067\u3059",
    text: "\u9055\u3063\u3066\u3044\u305f\u3089\u3001\u3044\u3064\u3082\u306e\u3088\u3046\u306b\u9078\u3073\u76f4\u3057\u3066\u304f\u3060\u3055\u3044",
  },
];

export const CURRENT_OPTIONS = [
  {
    label: "\u306d\u3066\u308b",
    signal: "sleeping",
  },
  {
    label: "\u30b0\u30eb\u30fc\u30df\u30f3\u30b0",
    signal: "grooming",
  },
  {
    label: "\u904a\u3093\u3067\u308b",
    signal: "playing",
  },
  {
    label: "\u3054\u98ef\u305f\u3079\u305f",
    signal: "after_food",
  },
  {
    label: "\u30c8\u30a4\u30ec\u3057\u305f",
    signal: "toilet",
  },
  {
    label: "\u30b4\u30ed\u30b4\u30ed\u3057\u3066\u308b",
    signal: "purring",
  },
];

export const CONCERN_OPTIONS = [
  {
    label: "\u9cf4\u3044\u3066\u308b",
    input: "meowing",
  },
  {
    label: "\u3064\u3044\u3066\u304f\u308b",
    input: "following",
  },
  {
    label: "\u843d\u3061\u7740\u304b\u306a\u3044",
    input: "restless",
  },
  {
    label: "\u5143\u6c17\u306a\u3044",
    input: "low_energy",
  },
  {
    label: "\u30b1\u30f3\u30ab\u3057\u3066\u308b",
    input: "fighting",
  },
  {
    label: "\u3088\u304f\u308f\u304b\u3089\u306a\u3044",
    input: "unknown",
  },
];

const PREDICTED_CONCERN_LABELS: Record<ConcernSignal, string> = {
  meowing: "\u9cf4\u3044\u3066\u308b\u304b\u3082",
  following: "\u3064\u3044\u3066\u304d\u3066\u308b\u304b\u3082",
  restless: "\u843d\u3061\u7740\u304b\u306a\u3044\u304b\u3082",
  low_energy: "\u5143\u6c17\u306a\u3044\u304b\u3082",
  fighting: "\u30b1\u30f3\u30ab\u3057\u3066\u308b\u304b\u3082",
  unknown: "\u3088\u304f\u308f\u304b\u3089\u306a\u3044\u304b\u3082",
};

const FALLBACK_PREDICTED_SIGNALS: ConcernSignal[] = ["meowing", "following"];
const DEFAULT_CAT_NAME = "\u30df\u30b1";

export function getGuidanceByUnderstanding(percent: number) {
  return (
    GUIDANCE_BY_UNDERSTANDING.find((guidance) => percent <= guidance.max) ??
    GUIDANCE_BY_UNDERSTANDING[GUIDANCE_BY_UNDERSTANDING.length - 1]
  );
}

export function buildPredictedConcernOptions(recentEvents: RecentEvent[]) {
  const stats = new Map<ConcernSignal, { count: number; latestIndex: number }>();

  recentEvents.forEach((event, index) => {
    if (event.event_type !== "concern" || !isConcernSignal(event.signal)) {
      return;
    }

    const current = stats.get(event.signal);

    stats.set(event.signal, {
      count: (current?.count ?? 0) + 1,
      latestIndex: current ? Math.min(current.latestIndex, index) : index,
    });
  });

  const rankedSignals = [...stats.entries()]
    .sort(([, a], [, b]) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.latestIndex - b.latestIndex;
    })
    .map(([signal]) => signal);

  for (const signal of FALLBACK_PREDICTED_SIGNALS) {
    if (!rankedSignals.includes(signal)) {
      rankedSignals.push(signal);
    }
  }

  return rankedSignals.slice(0, 2).map((input) => ({
    input,
    label: PREDICTED_CONCERN_LABELS[input],
  }));
}

export function readCatProfile() {
  const value = window.localStorage.getItem("cat_profile");

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<CatProfile>;

    if (!parsed.name) {
      return null;
    }

    return {
      name: parsed.name,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      updatedAt: parsed.updatedAt ?? parsed.createdAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveCatProfile(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  const current = readCatProfile();
  const now = new Date().toISOString();
  const profile: CatProfile = {
    name: trimmedName,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };

  window.localStorage.setItem("cat_profile", JSON.stringify(profile));

  return profile;
}

export function getCatName(profile: CatProfile | null) {
  return profile?.name || DEFAULT_CAT_NAME;
}

export function readLatestHypothesis() {
  const value = window.localStorage.getItem("latest_hypothesis");

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      source?: string;
      text?: string;
      category?: string;
      diagnosisId?: string | null;
      createdAt?: string;
      expiresAt?: string;
    };

    if (!parsed.text) {
      return null;
    }

    if (isExpiredLatestHypothesis(parsed)) {
      window.localStorage.removeItem("latest_hypothesis");
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearLatestHypothesis() {
  window.localStorage.removeItem("latest_hypothesis");
  window.localStorage.removeItem("last_input_signal");
  window.localStorage.removeItem("last_context");
  window.localStorage.removeItem("last_primary_category");
}

export function parseStoredContext(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getHypothesisCompletionMessage(category: string) {
  if (category === "health") {
    return "\u8a18\u9332\u3057\u307e\u3057\u305f\u3002\n\u6c17\u306b\u306a\u308b\u69d8\u5b50\u304c\u7d9a\u304f\u3068\u304d\u306f\u3001\u65e9\u3081\u306b\u76f8\u8ac7\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
  }

  return "\u8a18\u9332\u3057\u307e\u3057\u305f\u3002\n\u307e\u305f\u5c11\u3057\u3001\u3053\u306e\u5b50\u306e\u50be\u5411\u304c\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002";
}

function isConcernSignal(signal: string): signal is ConcernSignal {
  return signal in PREDICTED_CONCERN_LABELS;
}

function isExpiredLatestHypothesis(hypothesis: {
  source?: string;
  createdAt?: string;
  expiresAt?: string;
}) {
  if (hypothesis.expiresAt) {
    return new Date(hypothesis.expiresAt).getTime() < Date.now();
  }

  if (hypothesis.source === "diagnosis" && hypothesis.createdAt) {
    const createdAtTime = new Date(hypothesis.createdAt).getTime();

    if (Number.isNaN(createdAtTime)) {
      return true;
    }

    return Date.now() - createdAtTime > 3 * 60 * 60 * 1000;
  }

  return false;
}
