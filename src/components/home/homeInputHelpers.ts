import type { RecentEvent } from "../../lib/supabase/queries";

export type LatestHypothesisView = {
  input: string;
  context: Record<string, unknown>;
  category: string;
  text?: string;
  source?: string;
  diagnosisId?: string | null;
  localCatId?: string | null;
};

export type CatProfile = {
  id: string;
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

type DailyHintCategory =
  | "food"
  | "play"
  | "social"
  | "stress"
  | "health"
  | "unknown";

type DailyHintPattern =
  | DailyHintCategory
  | "sleeping"
  | "grooming"
  | "after_food"
  | "toilet";

export type DailyHintHypothesis = {
  category: DailyHintCategory;
  shownSignal: string | null;
  text: string;
  body: string;
  cta: {
    main: string;
    sub: string;
  };
};

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
    title: "\u6700\u8fd1\u306e\u8a18\u9332\u304b\u3089\u3001\u6c17\u306b\u306a\u308b\u69d8\u5b50\u3092\u5148\u306b\u898b\u3089\u308c\u307e\u3059",
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
  meowing: "\u9cf4\u3044\u3066\u308b\u3092\u307f\u308b",
  following: "\u3064\u3044\u3066\u304d\u3066\u308b\u3092\u307f\u308b",
  restless: "\u843d\u3061\u7740\u304b\u306a\u3044\u3092\u307f\u308b",
  low_energy: "\u5143\u6c17\u306a\u3044\u3092\u307f\u308b",
  fighting: "\u30b1\u30f3\u30ab\u3057\u3066\u308b\u3092\u307f\u308b",
  unknown: "\u3088\u304f\u308f\u304b\u3089\u306a\u3044\u3092\u307f\u308b",
};

const FALLBACK_PREDICTED_SIGNALS: ConcernSignal[] = ["meowing", "following"];
const DAILY_HINT_PATTERNS: Record<
  DailyHintPattern,
  DailyHintHypothesis
> = {
  food: {
    category: "food",
    shownSignal: "food",
    text: "\u304a\u8179\u304c\u7a7a\u3044\u3066\u3044\u308b\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
    body: "\u3054\u306f\u3093\u306b\u95a2\u4fc2\u3059\u308b\u8a18\u9332\u304c\u3042\u308a\u307e\u3059\u3002\u9055\u3063\u3066\u3044\u305f\u3089\u3001\u4e0b\u304b\u3089\u9078\u3073\u76f4\u305b\u307e\u3059\u3002",
    cta: {
      main: "\u3054\u306f\u3093\u3092\u78ba\u8a8d\u3057\u305f",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
  play: {
    category: "play",
    shownSignal: "play",
    text: "\u904a\u3073\u305f\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
    body: "\u6700\u8fd1\u306e\u8a18\u9332\u304b\u3089\u3001\u307e\u305a\u8a66\u3057\u3084\u3059\u3044\u5019\u88dc\u3067\u3059\u3002\u9055\u3063\u3066\u3044\u305f\u3089\u3001\u4e0b\u304b\u3089\u9078\u3073\u76f4\u305b\u307e\u3059\u3002",
    cta: {
      main: "\u904a\u3093\u3067\u307f\u305f",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
  social: {
    category: "social",
    shownSignal: "social",
    text: "\u304b\u307e\u3063\u3066\u307b\u3057\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
    body: "\u305d\u3070\u306b\u3044\u305f\u3044\u3001\u5b89\u5fc3\u3057\u305f\u3044\u30b5\u30a4\u30f3\u304b\u3082\u3057\u308c\u307e\u305b\u3093\u3002\u9055\u3063\u3066\u3044\u305f\u3089\u3001\u4e0b\u304b\u3089\u9078\u3073\u76f4\u305b\u307e\u3059\u3002",
    cta: {
      main: "\u304b\u307e\u3063\u3066\u307f\u305f",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
  stress: {
    category: "stress",
    shownSignal: "stress",
    text: "\u5c11\u3057\u843d\u3061\u7740\u304b\u306a\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
    body: "\u843d\u3061\u7740\u304b\u306a\u3044\u69d8\u5b50\u304c\u3042\u308b\u305f\u3081\u3001\u74b0\u5883\u3084\u523a\u6fc0\u3092\u898b\u76f4\u3057\u3066\u3082\u3088\u3055\u305d\u3046\u3067\u3059\u3002",
    cta: {
      main: "\u843d\u3061\u7740\u3051\u308b\u3088\u3046\u306b\u3057\u305f",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
  health: {
    category: "health",
    shownSignal: "health",
    text: "\u4f53\u8abf\u306b\u6ce8\u610f\u3057\u305f\u65b9\u304c\u3088\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
    body: "\u5143\u6c17\u304c\u306a\u3044\u69d8\u5b50\u306f\u3001\u65e9\u3081\u306b\u898b\u3066\u304a\u304d\u305f\u3044\u30b5\u30a4\u30f3\u3067\u3059\u3002\u7d9a\u304f\u5834\u5408\u306f\u76f8\u8ac7\u3082\u8003\u3048\u3066\u304f\u3060\u3055\u3044\u3002",
    cta: {
      main: "\u4f53\u8abf\u3092\u78ba\u8a8d\u3057\u305f",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
  unknown: {
    category: "unknown",
    shownSignal: "unknown",
    text: "\u307e\u3060\u306f\u3063\u304d\u308a\u3057\u307e\u305b\u3093",
    body: "\u6700\u8fd1\u306e\u8a18\u9332\u3060\u3051\u3067\u306f\u5224\u65ad\u3057\u304d\u308c\u307e\u305b\u3093\u3002\u8fd1\u3044\u69d8\u5b50\u3092\u9078\u3073\u76f4\u3057\u3066\u307f\u3066\u304f\u3060\u3055\u3044\u3002",
    cta: {
      main: "\u69d8\u5b50\u3092\u898b\u308b",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
  sleeping: {
    category: "stress",
    shownSignal: "sleeping",
    text: "\u4f11\u307f\u305f\u3044\u6642\u9593\u304b\u3082\u3057\u308c\u307e\u305b\u3093",
    body: "\u7720\u3063\u3066\u3044\u308b\u8a18\u9332\u304c\u3042\u308a\u307e\u3059\u3002\u7121\u7406\u306b\u69cb\u308f\u305a\u3001\u305d\u3063\u3068\u898b\u5b88\u3063\u3066\u3082\u3088\u3055\u305d\u3046\u3067\u3059\u3002",
    cta: {
      main: "\u305d\u3063\u3068\u3057\u3066\u304a\u304f",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
  grooming: {
    category: "stress",
    shownSignal: "grooming",
    text: "\u843d\u3061\u7740\u3053\u3046\u3068\u3057\u3066\u3044\u308b\u304b\u3082\u3057\u308c\u307e\u305b\u3093",
    body: "\u30b0\u30eb\u30fc\u30df\u30f3\u30b0\u306f\u6c17\u6301\u3061\u3092\u6574\u3048\u308b\u6642\u306b\u3082\u898b\u3089\u308c\u307e\u3059\u3002\u7d9a\u304f\u69d8\u5b50\u3092\u898b\u3066\u307f\u307e\u3057\u3087\u3046\u3002",
    cta: {
      main: "\u69d8\u5b50\u3092\u898b\u308b",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
  after_food: {
    category: "food",
    shownSignal: "after_food",
    text: "\u3054\u306f\u3093\u306e\u3042\u3068\u306f\u843d\u3061\u7740\u304d\u3084\u3059\u3044\u6642\u9593\u304b\u3082\u3057\u308c\u307e\u305b\u3093",
    body: "\u3054\u98ef\u306e\u8a18\u9332\u304c\u3042\u308a\u307e\u3059\u3002\u3053\u306e\u3042\u3068\u306e\u69d8\u5b50\u3082\u5c11\u3057\u898b\u3066\u304a\u304f\u3068\u5b89\u5fc3\u3067\u3059\u3002",
    cta: {
      main: "\u69d8\u5b50\u3092\u898b\u308b",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
  toilet: {
    category: "health",
    shownSignal: "toilet",
    text: "\u30c8\u30a4\u30ec\u5f8c\u306e\u69d8\u5b50\u3082\u898b\u3066\u304a\u304f\u3068\u3088\u3055\u305d\u3046\u3067\u3059",
    body: "\u30c8\u30a4\u30ec\u306e\u8a18\u9332\u304c\u3042\u308a\u307e\u3059\u3002\u3044\u3064\u3082\u3068\u9055\u3046\u69d8\u5b50\u304c\u3042\u308c\u3070\u3001\u6c17\u306b\u306a\u308b\u3053\u3068\u304b\u3089\u8a18\u9332\u3067\u304d\u307e\u3059\u3002",
    cta: {
      main: "\u69d8\u5b50\u3092\u898b\u308b",
      sub: "\u9055\u3046\u304b\u3082",
    },
  },
};
const DEFAULT_CAT_NAME = "\u30df\u30b1";
const CAT_PROFILES_KEY = "cat_profiles";
const ACTIVE_CAT_ID_KEY = "active_cat_id";
const LEGACY_CAT_PROFILE_KEY = "cat_profile";

// MVP only: this switches the local UI profile. Supabase tracking rows use
// local_cat_id for provisional separation until cats/cat_id are introduced.

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

export function buildDailyHintHypothesis(
  recentEvents: RecentEvent[],
): DailyHintHypothesis {
  const stats = new Map<
    DailyHintPattern,
    { score: number; latestIndex: number; signal: string | null }
  >();

  recentEvents.forEach((event, index) => {
    const pattern = getDailyHintPattern(event.signal);

    if (!pattern) {
      return;
    }

    const current = stats.get(pattern);

    stats.set(pattern, {
      score: (current?.score ?? 0) + getDailyHintSignalWeight(event.signal),
      latestIndex: current ? Math.min(current.latestIndex, index) : index,
      signal:
        !current || index < current.latestIndex ? event.signal : current.signal,
    });
  });

  const [pattern, selectedStats] =
    [...stats.entries()].sort(([, a], [, b]) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.latestIndex - b.latestIndex;
    })[0] ?? ["play", { score: 0, latestIndex: 0, signal: null }];

  return {
    ...DAILY_HINT_PATTERNS[pattern],
    shownSignal: selectedStats.signal ?? DAILY_HINT_PATTERNS[pattern].shownSignal,
  };
}

export function createLocalCatProfile(
  name = DEFAULT_CAT_NAME,
  timestamps?: { createdAt?: string; updatedAt?: string },
): CatProfile {
  const now = new Date().toISOString();

  return {
    id: `local-cat-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    name,
    createdAt: timestamps?.createdAt ?? now,
    updatedAt: timestamps?.updatedAt ?? timestamps?.createdAt ?? now,
  };
}

export function readCatProfiles() {
  const savedProfiles = readStoredCatProfiles();

  if (savedProfiles.length > 0) {
    return savedProfiles;
  }

  const migratedProfiles = migrateLegacyCatProfile();

  if (migratedProfiles.length > 0) {
    return migratedProfiles;
  }

  const defaultProfile = createLocalCatProfile();
  saveCatProfiles([defaultProfile]);
  saveActiveCatId(defaultProfile.id);

  return [defaultProfile];
}

export function saveCatProfiles(profiles: CatProfile[]) {
  window.localStorage.setItem(CAT_PROFILES_KEY, JSON.stringify(profiles));
}

export function readActiveCatId() {
  return window.localStorage.getItem(ACTIVE_CAT_ID_KEY);
}

export function saveActiveCatId(catId: string) {
  window.localStorage.setItem(ACTIVE_CAT_ID_KEY, catId);
}

export function getActiveCatProfile(
  profiles: CatProfile[],
  activeCatId: string | null,
) {
  return (
    profiles.find((profile) => profile.id === activeCatId) ??
    profiles[0] ??
    createLocalCatProfile()
  );
}

export function addCatProfile(profiles: CatProfile[], name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  const profile = createLocalCatProfile(trimmedName);
  const nextProfiles = [...profiles, profile];

  saveCatProfiles(nextProfiles);
  saveActiveCatId(profile.id);

  return {
    activeCatId: profile.id,
    profiles: nextProfiles,
  };
}

export function updateCatProfileName(
  profiles: CatProfile[],
  activeCatId: string | null,
  name: string,
) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  const activeProfile = getActiveCatProfile(profiles, activeCatId);
  const now = new Date().toISOString();
  const nextProfiles = profiles.map((profile) =>
    profile.id === activeProfile.id
      ? {
          ...profile,
          name: trimmedName,
          updatedAt: now,
        }
      : profile,
  );

  saveCatProfiles(nextProfiles);
  saveActiveCatId(activeProfile.id);

  return {
    activeCatId: activeProfile.id,
    profiles: nextProfiles,
  };
}

export function getCatName(profile: CatProfile | null) {
  return profile?.name || DEFAULT_CAT_NAME;
}

function readStoredCatProfiles() {
  const value = window.localStorage.getItem(CAT_PROFILES_KEY);

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Partial<CatProfile>[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((profile) => profile.id && profile.name)
      .map((profile) => ({
        id: profile.id as string,
        name: profile.name as string,
        createdAt: profile.createdAt ?? new Date().toISOString(),
        updatedAt:
          profile.updatedAt ?? profile.createdAt ?? new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function migrateLegacyCatProfile() {
  const value = window.localStorage.getItem(LEGACY_CAT_PROFILE_KEY);

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Partial<Omit<CatProfile, "id">>;

    if (!parsed.name) {
      return [];
    }

    const profile = createLocalCatProfile(parsed.name, {
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    });

    saveCatProfiles([profile]);
    saveActiveCatId(profile.id);

    return [profile];
  } catch {
    return [];
  }
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
      localCatId?: string | null;
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

function getDailyHintPattern(signal: string): DailyHintPattern | null {
  if (signal === "sleeping") {
    return "sleeping";
  }

  if (signal === "grooming") {
    return "grooming";
  }

  if (signal === "toilet") {
    return "toilet";
  }

  if (signal === "after_food" || signal === "eating") {
    return "after_food";
  }

  if (signal === "low_energy") {
    return "health";
  }

  if (signal === "restless" || signal === "fighting") {
    return "stress";
  }

  if (signal === "following" || signal === "purring") {
    return "social";
  }

  if (signal === "playing" || signal === "meowing") {
    return "play";
  }

  if (signal === "unknown") {
    return "unknown";
  }

  return null;
}

function getDailyHintSignalWeight(signal: string) {
  if (signal === "low_energy") {
    return 3;
  }

  if (
    signal === "playing" ||
    signal === "following" ||
    signal === "purring" ||
    signal === "sleeping" ||
    signal === "grooming" ||
    signal === "after_food" ||
    signal === "eating" ||
    signal === "toilet" ||
    signal === "restless" ||
    signal === "fighting"
  ) {
    return 2;
  }

  return 1;
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
