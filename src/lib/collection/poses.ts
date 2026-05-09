export type RecordPoseCategory = {
  label: string;
  slug: string;
  discoverySignals: string[];
  tone: PoseTone;
};

export type PhotoCollectionPose = {
  id?: string;
  label: string;
  slug: string;
  silhouetteKey?: string;
};

export type CollectionGroupId = "pose" | "scene";

export type CollectionSlot = {
  id: string;
  label: string;
  group: CollectionGroupId;
  silhouetteKey: string;
  iconPath: string;
};

export type CollectionGroup = {
  id: CollectionGroupId;
  label: string;
  slots: CollectionSlot[];
};

export type PoseCategory = RecordPoseCategory;
export type PoseTone = "normal" | "social" | "concern";

type PoseEventLike = {
  signal: string;
  label?: string | null;
};

export const RECORD_POSE_CATEGORIES: RecordPoseCategory[] = [
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

export const PHOTO_COLLECTION_POSES: PhotoCollectionPose[] = [
  {
    label: "へそ天",
    slug: "belly_up",
  },
  {
    label: "箱入り",
    slug: "in_box",
  },
  {
    label: "のびー",
    slug: "stretch",
  },
  {
    label: "ごめん寝",
    slug: "face_down_sleep",
  },
  {
    label: "香箱",
    slug: "loaf",
  },
  {
    label: "窓辺",
    slug: "window_watch",
  },
  {
    label: "液体化",
    slug: "liquid_cat",
  },
  {
    label: "まるまり",
    slug: "curled_up",
  },
  {
    label: "しっぽピーン",
    slug: "tail_up",
  },
  {
    label: "おすわり",
    slug: "sitting",
  },
  {
    label: "変な寝相",
    slug: "funny_sleep",
  },
  {
    label: "ふみふみ",
    slug: "kneading",
  },
];

export const COLLECTION_GROUPS: CollectionGroup[] = [
  {
    id: "pose",
    label: "ポーズ",
    slots: [
      {
        id: "belly-up",
        label: "へそ天",
        group: "pose",
        silhouetteKey: "belly-up",
        iconPath: "/icons/collection/01_hesoten_belly_up.png",
      },
      {
        id: "loaf",
        label: "香箱",
        group: "pose",
        silhouetteKey: "loaf",
        iconPath: "/icons/collection/02_kobako_loaf_pose.png",
      },
      {
        id: "stretch",
        label: "のびー",
        group: "pose",
        silhouetteKey: "stretch",
        iconPath: "/icons/collection/03_nobii_stretching.png",
      },
      {
        id: "face-down-sleep",
        label: "ごめん寝",
        group: "pose",
        silhouetteKey: "face-down-sleep",
        iconPath: "/icons/collection/04_gomennne_sorry_sleep.png",
      },
      {
        id: "curled-up",
        label: "まるまり",
        group: "pose",
        silhouetteKey: "curled-up",
        iconPath: "/icons/collection/05_marumari_curled_up.png",
      },
      {
        id: "liquid",
        label: "液体化",
        group: "pose",
        silhouetteKey: "liquid",
        iconPath: "/icons/collection/06_ekitaika_melting.png",
      },
      {
        id: "sitting",
        label: "おすわり",
        group: "pose",
        silhouetteKey: "sitting",
        iconPath: "/icons/collection/07_osuwari_sitting.png",
      },
      {
        id: "tail-up",
        label: "しっぽピーン",
        group: "pose",
        silhouetteKey: "tail-up",
        iconPath: "/icons/collection/08_shippo_piin_tail_up.png",
      },
      {
        id: "weird-sleep",
        label: "変な寝相",
        group: "pose",
        silhouetteKey: "weird-sleep",
        iconPath: "/icons/collection/09_henna_nezou_weird_sleeping.png",
      },
      {
        id: "hidden-paws",
        label: "おててないない",
        group: "pose",
        silhouetteKey: "hidden-paws",
        iconPath: "/icons/collection/10_otete_nainai_hidden_paws.png",
      },
    ],
  },
  {
    id: "scene",
    label: "シーン",
    slots: [
      {
        id: "in-box",
        label: "箱入り",
        group: "scene",
        silhouetteKey: "in-box",
        iconPath: "/icons/collection/11_hakoiri_in_box.png",
      },
      {
        id: "by-window",
        label: "窓辺",
        group: "scene",
        silhouetteKey: "by-window",
        iconPath: "/icons/collection/12_madobe_window_side.png",
      },
      {
        id: "sunbathing",
        label: "ひなたぼっこ",
        group: "scene",
        silhouetteKey: "sunbathing",
        iconPath: "/icons/collection/13_hinatabokko_sunbathing.png",
      },
      {
        id: "in-futon",
        label: "布団入り",
        group: "scene",
        silhouetteKey: "in-futon",
        iconPath: "/icons/collection/14_futon_iri_under_covers.png",
      },
      {
        id: "high-place",
        label: "高いところ",
        group: "scene",
        silhouetteKey: "high-place",
        iconPath: "/icons/collection/15_takai_tokoro_high_place.png",
      },
      {
        id: "waiting-food",
        label: "ごはん待ち",
        group: "scene",
        silhouetteKey: "waiting-food",
        iconPath: "/icons/collection/16_gohan_machi_waiting_food.png",
      },
      {
        id: "welcome-home",
        label: "お出迎え",
        group: "scene",
        silhouetteKey: "welcome-home",
        iconPath: "/icons/collection/17_odemukae_greeting_door.png",
      },
      {
        id: "blanket-kneading",
        label: "毛布ふみふみ",
        group: "scene",
        silhouetteKey: "blanket-kneading",
        iconPath: "/icons/collection/18_moufu_fumifumi_kneading_blanket.png",
      },
    ],
  },
];

const POSE_CATEGORY_BY_SIGNAL = new Map(
  RECORD_POSE_CATEGORIES.flatMap((pose) =>
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

  return RECORD_POSE_CATEGORIES.find((pose) => pose.slug === slugFromLabel) ?? null;
}

export function getPoseCategoryForEvent(event: PoseEventLike) {
  return getPoseCategoryForSignal(event.signal, event.label);
}

export function getPoseTone(slug: string): PoseTone {
  return RECORD_POSE_CATEGORIES.find((pose) => pose.slug === slug)?.tone ?? "normal";
}

export function isConcernPose(slug: string) {
  return getPoseTone(slug) === "concern";
}

export function isSocialPose(slug: string) {
  return getPoseTone(slug) === "social";
}

export function buildRecordedPoseSlugs(events: PoseEventLike[]) {
  const slugs = new Set<string>();

  events.forEach((event) => {
    const pose = getPoseCategoryForEvent(event);

    if (pose) {
      slugs.add(pose.slug);
    }
  });

  return slugs;
}
