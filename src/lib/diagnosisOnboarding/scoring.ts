import { ONBOARDING_QUESTIONS, TOTAL_ONBOARDING_QUESTIONS } from "./questions";
import {
  CATEGORIES,
  TYPE_LABELS,
  type CategoryScores,
  type DeterminedType,
  type OnboardingAnswers,
  type OnboardingOptionDefinition,
  type OnboardingResult,
  type UnderstandingInput,
  type UnderstandingResult,
} from "./types";

const TYPE_CATEGORIES = ["play", "food", "social", "stress"] as const;

const HEALTH_MODIFIERS = new Set(["食欲ムラ", "トイレ変化注意", "体調変化出やすい"]);

function createEmptyScores(): CategoryScores {
  return CATEGORIES.reduce((scores, category) => {
    scores[category] = 0;
    return scores;
  }, {} as CategoryScores);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundPercent(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function getSelectedOptions(answers: OnboardingAnswers): OnboardingOptionDefinition[] {
  return ONBOARDING_QUESTIONS.flatMap((question) => {
    const selectedOptionId = answers[question.questionId];
    if (!selectedOptionId) {
      return [];
    }

    const selectedOption = question.options.find((option) => option.optionId === selectedOptionId);
    return selectedOption ? [selectedOption] : [];
  });
}

export function calculateOnboardingScores(answers: OnboardingAnswers): CategoryScores {
  const scores = createEmptyScores();

  for (const option of getSelectedOptions(answers)) {
    for (const category of CATEGORIES) {
      scores[category] += option.score[category] ?? 0;
    }
  }

  return scores;
}

export function determineType(scores: CategoryScores): DeterminedType {
  const typeScores = TYPE_CATEGORIES.map((category) => ({
    category,
    score: scores[category],
  })).sort((a, b) => b.score - a.score);

  const [top, second] = typeScores;
  const typeTotal = TYPE_CATEGORIES.reduce((total, category) => total + scores[category], 0);

  if (!top || typeTotal < 3) {
    return {
      typeKey: "balanced",
      typeLabel: TYPE_LABELS.balanced,
      topCategory: null,
      reason: "low_score",
    };
  }

  if (second && top.score - second.score < 2) {
    return {
      typeKey: "balanced",
      typeLabel: TYPE_LABELS.balanced,
      topCategory: top.category,
      reason: "close_score",
    };
  }

  return {
    typeKey: top.category,
    typeLabel: TYPE_LABELS[top.category],
    topCategory: top.category,
    reason: "top_score",
  };
}

export function extractModifiers(answers: OnboardingAnswers, scores: CategoryScores): string[] {
  const modifierCounts = new Map<string, number>();

  for (const option of getSelectedOptions(answers)) {
    for (const modifier of option.modifierCandidates) {
      modifierCounts.set(modifier, (modifierCounts.get(modifier) ?? 0) + 1);
    }
  }

  const entries = [...modifierCounts.entries()];
  const healthIsNoticeable = scores.health >= 2;

  const primaryCandidates = entries.filter(
    ([modifier, count]) => count >= 2 || (healthIsNoticeable && HEALTH_MODIFIERS.has(modifier)),
  );

  const fallbackCandidates = entries.filter(
    ([modifier]) => !primaryCandidates.some(([candidate]) => candidate === modifier),
  );

  return [...primaryCandidates, ...fallbackCandidates]
    .sort(([modifierA, countA], [modifierB, countB]) => {
      const healthPriorityA = healthIsNoticeable && HEALTH_MODIFIERS.has(modifierA) ? 1 : 0;
      const healthPriorityB = healthIsNoticeable && HEALTH_MODIFIERS.has(modifierB) ? 1 : 0;

      if (healthPriorityA !== healthPriorityB) {
        return healthPriorityB - healthPriorityA;
      }

      if (countA !== countB) {
        return countB - countA;
      }

      return modifierA.localeCompare(modifierB, "ja");
    })
    .slice(0, 2)
    .map(([modifier]) => modifier);
}

export function calculateUnderstandingPercent(params: UnderstandingInput = {}): UnderstandingResult {
  const totalQuestions = params.totalQuestions ?? TOTAL_ONBOARDING_QUESTIONS;
  const answeredCount = params.answeredCount ?? 0;

  const onboarding = totalQuestions > 0 ? (answeredCount / totalQuestions) * 40 : 0;
  const events = params.eventsPercent ?? Math.min((params.eventsCount ?? 0) * 3, 30);
  const feedbacks = params.feedbacksPercent ?? Math.min((params.feedbacksCount ?? 0) * 4, 20);
  const hintFeedbacks =
    params.hintFeedbacksPercent ?? Math.min((params.hintFeedbacksCount ?? 0) * 2, 10);

  const sourceBreakdown = {
    onboarding: roundPercent(onboarding),
    events: roundPercent(events),
    feedbacks: roundPercent(feedbacks),
    hintFeedbacks: roundPercent(hintFeedbacks),
  };

  return {
    percent: roundPercent(
      sourceBreakdown.onboarding +
        sourceBreakdown.events +
        sourceBreakdown.feedbacks +
        sourceBreakdown.hintFeedbacks,
    ),
    sourceBreakdown,
  };
}

export function buildOnboardingResult(answers: OnboardingAnswers): OnboardingResult {
  const answeredCount = getSelectedOptions(answers).length;
  const scores = calculateOnboardingScores(answers);

  return {
    scores,
    type: determineType(scores),
    modifiers: extractModifiers(answers, scores),
    understanding: calculateUnderstandingPercent({ answeredCount }),
    answeredCount,
    skippedCount: Math.max(TOTAL_ONBOARDING_QUESTIONS - answeredCount, 0),
  };
}
