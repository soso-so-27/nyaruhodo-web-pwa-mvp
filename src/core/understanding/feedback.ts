import type { CauseCategory, DiagnosisFeedback } from "../types";
import { adjustMemoryWeight, getMemoryWeights } from "../logic/weights";

const feedbackAdjustment: Record<DiagnosisFeedback, number> = {
  resolved: 10,
  unresolved: -10,
};

export function applyDiagnosisFeedback(
  categories: CauseCategory | CauseCategory[],
  feedback: DiagnosisFeedback,
) {
  const targetCategories = Array.isArray(categories) ? categories : [categories];

  for (const category of targetCategories) {
    adjustMemoryWeight(category, feedbackAdjustment[feedback]);
  }

  return getMemoryWeights();
}
