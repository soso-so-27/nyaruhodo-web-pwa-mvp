export type PoseCategory = {
  label: string;
  slug: string;
  discoverySignals: string[];
};

type PoseEventLike = {
  signal: string;
  label?: string | null;
};

export const POSE_CATEGORIES: PoseCategory[] = [
  { label: "ねむる", slug: "sleeping", discoverySignals: ["sleeping"] },
  { label: "毛づくろい", slug: "grooming", discoverySignals: ["grooming"] },
  { label: "あそぶ", slug: "playing", discoverySignals: ["playing"] },
  {
    label: "ごはん",
    slug: "food",
    discoverySignals: ["food", "after_food", "eating"],
  },
  { label: "トイレ", slug: "toilet", discoverySignals: ["toilet"] },
  { label: "ごきげん", slug: "purring", discoverySignals: ["purring"] },
  { label: "おしゃべり", slug: "meowing", discoverySignals: ["meowing"] },
  { label: "ついてくる", slug: "following", discoverySignals: ["following"] },
  { label: "そわそわ", slug: "restless", discoverySignals: ["restless"] },
  { label: "休む", slug: "low_energy", discoverySignals: ["low_energy"] },
  { label: "ケンカ", slug: "fighting", discoverySignals: ["fighting"] },
  { label: "よくわからない", slug: "unknown", discoverySignals: ["unknown"] },
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
