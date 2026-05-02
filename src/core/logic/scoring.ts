import type {
  BehaviorInput,
  CategoryScores,
  CauseCategory,
  DiagnosisContext,
} from "../types";
import { getMemoryWeights } from "./weights";

const categories: CauseCategory[] = ["food", "play", "social", "stress", "health"];

const baseScores: Record<BehaviorInput, Partial<CategoryScores>> = {
  meowing: {
    food: 30,
    play: 20,
    social: 20,
  },
  following: {
    social: 50,
  },
  restless: {
    play: 40,
    stress: 30,
  },
  low_energy: {
    health: 60,
  },
  fighting: {
    stress: 50,
  },
};

const timeAdjustments: Record<
  NonNullable<DiagnosisContext["time"]>,
  Partial<CategoryScores>
> = {
  morning: {
    food: 20,
    social: 10,
  },
  night: {
    play: 20,
  },
  late_night: {
    food: -20,
    social: 10,
    stress: 10,
  },
};

const historyAdjustments: Record<
  NonNullable<DiagnosisContext["history"]>[number],
  Partial<CategoryScores>
> = {
  after_food: {
    food: -50,
  },
  after_play: {
    play: -30,
  },
};

const environmentAdjustments: Record<
  NonNullable<DiagnosisContext["environment"]>[number],
  Partial<CategoryScores>
> = {
  external_stimulus: {
    stress: 30,
  },
};

export function calculateScores(
  input: BehaviorInput,
  context: DiagnosisContext = {},
): CategoryScores {
  const scores = createEmptyScores();

  applyScores(scores, baseScores[input]);

  if (context.time) {
    applyScores(scores, timeAdjustments[context.time]);
  }

  applyScores(scores, getElapsedTimeAdjustments(context));

  for (const history of context.history ?? []) {
    applyScores(scores, historyAdjustments[history]);
  }

  for (const environment of context.environment ?? []) {
    applyScores(scores, environmentAdjustments[environment]);
  }

  applyScores(scores, getMemoryWeights());

  return scores;
}

function createEmptyScores(): CategoryScores {
  return categories.reduce(
    (scores, category) => ({
      ...scores,
      [category]: 0,
    }),
    {} as CategoryScores,
  );
}

function applyScores(
  scores: CategoryScores,
  adjustment: Partial<CategoryScores>,
): void {
  for (const [category, value] of Object.entries(adjustment) as [
    CauseCategory,
    number,
  ][]) {
    scores[category] += value;
  }
}

function getElapsedTimeAdjustments(
  context: DiagnosisContext,
): Partial<CategoryScores> {
  const adjustments: Partial<CategoryScores> = {};

  if (context.lastFoodMinutes !== undefined) {
    if (context.lastFoodMinutes <= 60) {
      adjustments.food = (adjustments.food ?? 0) - 50;
    }

    if (context.lastFoodMinutes >= 240) {
      adjustments.food = (adjustments.food ?? 0) + 20;
    }
  }

  if (
    context.lastPlayMinutes !== undefined &&
    context.lastPlayMinutes <= 120
  ) {
    adjustments.play = (adjustments.play ?? 0) - 30;
  }

  return adjustments;
}
