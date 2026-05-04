export const CATEGORIES = ["play", "food", "social", "stress", "health"] as const;

export type Category = (typeof CATEGORIES)[number];

export type TypeKey = "play" | "food" | "social" | "stress" | "balanced";

export type TypeLabel =
  | "あそびハンター"
  | "ごはんセンサー"
  | "かまってレーダー"
  | "びっくりセンサー"
  | "マイペース観察";

export const TYPE_LABELS: Record<TypeKey, TypeLabel> = {
  play: "あそびハンター",
  food: "ごはんセンサー",
  social: "かまってレーダー",
  stress: "びっくりセンサー",
  balanced: "マイペース観察",
};

export type OnboardingZone = "immediate" | "type_accuracy" | "understanding";

export type CategoryScores = Record<Category, number>;

export type ScoreInput = Partial<CategoryScores>;

export type ModifierCandidate = string;

export type OnboardingOptionDefinition = {
  optionId: string;
  label: string;
  score: ScoreInput;
  modifierCandidates: ModifierCandidate[];
};

export type OnboardingQuestionDefinition = {
  questionId: string;
  zone: OnboardingZone;
  question: string;
  options: OnboardingOptionDefinition[];
  skippable: boolean;
};

export type OnboardingAnswers = Record<string, string | null | undefined>;

export type TypeDeterminationReason = "top_score" | "low_score" | "close_score";

export type DeterminedType = {
  typeKey: TypeKey;
  typeLabel: TypeLabel;
  topCategory: Exclude<Category, "health"> | null;
  reason: TypeDeterminationReason;
};

export type UnderstandingSourceBreakdown = {
  onboarding: number;
  events: number;
  feedbacks: number;
  hintFeedbacks: number;
};

export type UnderstandingResult = {
  percent: number;
  sourceBreakdown: UnderstandingSourceBreakdown;
};

export type UnderstandingInput = {
  answeredCount?: number;
  totalQuestions?: number;
  eventsCount?: number;
  feedbacksCount?: number;
  hintFeedbacksCount?: number;
  eventsPercent?: number;
  feedbacksPercent?: number;
  hintFeedbacksPercent?: number;
};

export type OnboardingResult = {
  scores: CategoryScores;
  type: DeterminedType;
  modifiers: ModifierCandidate[];
  understanding: UnderstandingResult;
  answeredCount: number;
  skippedCount: number;
};
