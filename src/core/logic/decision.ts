import type { CategoryScores, CauseCategory, DiagnosisContext } from "../types";
import { applyDiagnosisFeedback } from "../understanding/feedback";
import { calculateScores } from "./scoring";
import { resetMemoryWeights } from "./weights";

export type DecisionResult = CauseCategory[];

export function decideCategories(scores: CategoryScores): DecisionResult {
  const ranked = rankScores(scores);
  const [top, second] = ranked;

  if (top.category === "health" && top.score > 0) {
    return ["health"];
  }

  if (second && top.score - second.score <= 10) {
    return [top.category, second.category];
  }

  return [top.category];
}

export function runDiagnosisLogicExamples() {
  resetMemoryWeights();

  const examples: {
    label: string;
    input: Parameters<typeof calculateScores>[0];
    context: DiagnosisContext;
  }[] = [
    {
      label: "\u591c\u306b\u9cf4\u3044\u3066\u3044\u308b",
      input: "meowing",
      context: {
        time: "night",
      },
    },
    {
      label: "\u671d\u306b\u3064\u304d\u307e\u3068\u3046",
      input: "following",
      context: {
        time: "morning",
      },
    },
  ];

  for (const example of examples) {
    const scores = calculateScores(example.input, example.context);
    const result = decideCategories(scores);

    console.log(example.label, {
      scores,
      result,
    });
  }

  const firstScores = calculateScores("meowing", { time: "night" });
  const firstResult = decideCategories(firstScores);
  const weights = applyDiagnosisFeedback(firstResult, "resolved");
  const nextScores = calculateScores("meowing", { time: "night" });
  const nextResult = decideCategories(nextScores);

  console.log("\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af\u53cd\u6620", {
    firstResult,
    weights,
    nextScores,
    nextResult,
  });
}

function rankScores(scores: CategoryScores) {
  return (Object.entries(scores) as [CauseCategory, number][])
    .map(([category, score]) => ({ category, score }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (a.category === "health") {
        return -1;
      }

      if (b.category === "health") {
        return 1;
      }

      return a.category.localeCompare(b.category);
    });
}
