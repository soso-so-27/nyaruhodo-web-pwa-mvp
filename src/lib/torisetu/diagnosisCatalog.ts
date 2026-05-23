export type TorisetuDiagnosisCategory =
  | "type"
  | "mood"
  | "play"
  | "food"
  | "stress"
  | "bond";

export type TorisetuDiagnosisUnlockRule =
  | {
      kind: "always";
    }
  | {
      kind: "recordCount";
      count: number;
    };

export type TorisetuDiagnosisDefinition = {
  id: string;
  category: TorisetuDiagnosisCategory;
  title: string;
  resultGroup: "diagnosis";
  // "onboarding" can be backed by today's existing cat profile.
  // "future" is a locked catalog entry until the questionnaire exists.
  source: "onboarding" | "future";
  unlockRule: TorisetuDiagnosisUnlockRule;
};

export type TorisetuLockedDiagnosisCard = {
  id: string;
  title: string;
  threshold: number;
};

export const TORISETU_DIAGNOSIS_DEFINITIONS: TorisetuDiagnosisDefinition[] = [
  {
    id: "type-diagnosis",
    category: "type",
    title: "タイプ診断",
    resultGroup: "diagnosis",
    source: "onboarding",
    unlockRule: { kind: "always" },
  },
  {
    id: "mood-diagnosis",
    category: "mood",
    title: "きもち診断",
    resultGroup: "diagnosis",
    source: "future",
    unlockRule: { kind: "recordCount", count: 8 },
  },
  {
    id: "play-diagnosis",
    category: "play",
    title: "あそび診断",
    resultGroup: "diagnosis",
    source: "future",
    unlockRule: { kind: "recordCount", count: 15 },
  },
  {
    id: "food-diagnosis",
    category: "food",
    title: "ごはん診断",
    resultGroup: "diagnosis",
    source: "future",
    unlockRule: { kind: "recordCount", count: 20 },
  },
  {
    id: "stress-diagnosis",
    category: "stress",
    title: "不安サイン診断",
    resultGroup: "diagnosis",
    source: "future",
    unlockRule: { kind: "recordCount", count: 25 },
  },
  {
    id: "bond-diagnosis",
    category: "bond",
    title: "距離感診断",
    resultGroup: "diagnosis",
    source: "future",
    unlockRule: { kind: "recordCount", count: 30 },
  },
];

export const TORISETU_LOCKED_DIAGNOSIS_SAMPLES: TorisetuLockedDiagnosisCard[] =
  TORISETU_DIAGNOSIS_DEFINITIONS.flatMap((definition) => {
    if (definition.unlockRule.kind !== "recordCount") {
      return [];
    }

    return {
      id: definition.id,
      title: definition.title,
      threshold: definition.unlockRule.count,
    };
  });
