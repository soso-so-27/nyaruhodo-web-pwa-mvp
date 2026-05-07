export type PoseCategory = {
  label: string;
  slug: string;
  discoverySignals: string[];
  tone: PoseTone;
};

export type PoseTone = "normal" | "social" | "concern";

type PoseEventLike = {
  signal: string;
  label?: string | null;
};

export const POSE_CATEGORIES: PoseCategory[] = [
  {
    label: "ねむる",
    slug: "sleeping",
    discoverySignals: ["sleeping"],
    tone: "normal",
  },
  {
    label: "毛づくろい",
    slug: "grooming",
    discoverySignals: ["grooming"],
    tone: "normal",
  },
  {
    label: "あそぶ",
    slug: "playing",
    discoverySignals: ["playing"],
    tone: "normal",
  },
  {
    label: "ごはん",
    slug: "food",
    discoverySignals: ["food", "after_food", "eating"],
    tone: "normal",
  },
  {
    label: "トイレ",
    slug: "toilet",
    discoverySignals: ["toilet"],
    tone: "normal",
  },
  {
    label: "ごきげん",
    slug: "purring",
    discoverySignals: ["purring"],
    tone: "normal",
  },
  {
    label: "おしゃべり",
    slug: "meowing",
    discoverySignals: ["meowing"],
    tone: "social",
  },
  {
    label: "ついてくる",
    slug: "following",
    discoverySignals: ["following"],
    tone: "social",
  },
  {
    label: "そわそわ",
    slug: "restless",
    discoverySignals: ["restless"],
    tone: "concern",
  },
  {
    label: "休む",
    slug: "low_energy",
    discoverySignals: ["low_energy"],
    tone: "concern",
  },
  {
    label: "ケンカ",
    slug: "fighting",
    discoverySignals: ["fighting"],
    tone: "concern",
  },
  {
    label: "よくわからない",
    slug: "unknown",
    discoverySignals: ["unknown"],
    tone: "concern",
  },
];

const POSE_CATEGORY_BY_SIGNAL = new Map(
  POSE_CATEGORIES.flatMap((pose) =>
    pose.discoverySignals.map((signal) => [signal, pose] as const),
  ),
);

const POSE_CATEGORY_BY_LABEL: Record<string, string> = {
  ねてる: "sleeping",
  眠る: "sleeping",
  グルーミング: "grooming",
  毛づくろい: "grooming",
  遊んでる: "playing",
  あそぶ: "playing",
  ご飯たべた: "food",
  ごはん: "food",
  ご飯: "food",
  トイレした: "toilet",
  トイレ: "toilet",
  ゴロゴロしてる: "purring",
  ゴロゴロ: "purring",
  鳴いてる: "meowing",
  ついてくる: "following",
  落ち着かない: "restless",
  そわそわ: "restless",
  元気ない: "low_energy",
  ケンカしてる: "fighting",
  ケンカ: "fighting",
  よくわからない: "unknown",
};

export function getPoseCategoryForSignal(
  signal: string,
  label?: string | null,
) {
  const poseFromSignal = POSE_CATEGORY_BY_SIGNAL.get(signal.trim());

  if (poseFromSignal) {
    return poseFromSignal;
  }

  const slugFromLabel = POSE_CATEGORY_BY_LABEL[(label || "").trim()];

  if (!slugFromLabel) {
    return null;
  }

  return POSE_CATEGORIES.find((pose) => pose.slug === slugFromLabel) ?? null;
}

export function getPoseCategoryForEvent(event: PoseEventLike) {
  return getPoseCategoryForSignal(event.signal, event.label);
}

export function getPoseTone(slug: string): PoseTone {
  return POSE_CATEGORIES.find((pose) => pose.slug === slug)?.tone ?? "normal";
}

export function isConcernPose(slug: string) {
  return getPoseTone(slug) === "concern";
}

export function isSocialPose(slug: string) {
  return getPoseTone(slug) === "social";
}

export function buildDiscoveredPoseSlugs(events: PoseEventLike[]) {
  const slugs = new Set<string>();

  events.forEach((event) => {
    const pose = getPoseCategoryForEvent(event);

    if (pose) {
      slugs.add(pose.slug);
    }
  });

  return slugs;
}
