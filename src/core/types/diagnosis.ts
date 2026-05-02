export type CauseCategory = "food" | "play" | "social" | "stress" | "health";

export type DiagnosisFeedback = "resolved" | "unresolved";

export type BehaviorInput =
  | "meowing"
  | "following"
  | "restless"
  | "low_energy"
  | "fighting";

export type TimeContext = "morning" | "night" | "late_night";

export type HistoryContext = "after_food" | "after_play";

export type EnvironmentContext = "external_stimulus";

export type DiagnosisContext = {
  time?: TimeContext;
  history?: HistoryContext[];
  environment?: EnvironmentContext[];
  lastFoodMinutes?: number;
  lastPlayMinutes?: number;
};

export type CategoryScores = Record<CauseCategory, number>;
