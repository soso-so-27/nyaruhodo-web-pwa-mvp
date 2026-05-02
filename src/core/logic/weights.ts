import type { CategoryScores, CauseCategory } from "../types";

const categories: CauseCategory[] = ["food", "play", "social", "stress", "health"];

const memoryWeights = createEmptyWeights();

export function getMemoryWeights(): CategoryScores {
  return { ...memoryWeights };
}

export function adjustMemoryWeight(category: CauseCategory, amount: number): void {
  memoryWeights[category] += amount;
}

export function resetMemoryWeights(): void {
  for (const category of categories) {
    memoryWeights[category] = 0;
  }
}

function createEmptyWeights(): CategoryScores {
  return categories.reduce(
    (weights, category) => ({
      ...weights,
      [category]: 0,
    }),
    {} as CategoryScores,
  );
}
