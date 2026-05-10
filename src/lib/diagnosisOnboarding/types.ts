// 3軸のスコア
export type AxisScores = {
  P: number; // 活動性（Play）
  C: number; // まったり（Calm）
  S: number; // 社交性（Social）
  I: number; // 独立（Independent）
  B: number; // どっしり（Bold）
  N: number; // 繊細（Nervous）
};

// 8タイプ
export type CatTypeKey =
  | "luce" // PSB
  | "fiore" // PSN
  | "leone" // PIB
  | "nimbus" // PIN
  | "sole" // CSB
  | "luna" // CSN
  | "stella" // CIB
  | "aura"; // CIN

export type CatTypeLabel =
  | "ルーチェ"
  | "フィオーレ"
  | "レオーネ"
  | "ニンバス"
  | "ソーレ"
  | "ルナ"
  | "ステラ"
  | "オーラ";

export type CatTypeInfo = {
  key: CatTypeKey;
  label: CatTypeLabel;
  axes: "PSB" | "PSN" | "PIB" | "PIN" | "CSB" | "CSN" | "CIB" | "CIN";
  tagline: string;
  description: string;
  trivia: string[];
  hint: string;
  rarity: number; // 0〜100のパーセンテージ
};

// 行動・時間パターン
export type ActivityPattern = {
  peakTime: "morning" | "afternoon" | "evening" | "night" | "random";
  foodSensitivity: "high" | "medium" | "low";
  stressSensitivity: "high" | "medium" | "low";
};

// オンボーディング結果
export type OnboardingResult = {
  typeKey: CatTypeKey;
  typeLabel: CatTypeLabel;
  typeInfo: CatTypeInfo;
  axisScores: AxisScores;
  activityPattern: ActivityPattern;
  provisionalTypeKey: CatTypeKey; // 途中結果
  answeredCount: number;
  completedAt: string;
};
