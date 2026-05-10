import type { ActivityPattern, AxisScores, CatTypeKey } from "./types";
import type { AnswerOption } from "./questions";
import { CAT_TYPES } from "./catTypes";

// スコアを集計
export function calcAxisScores(answers: AnswerOption[]): AxisScores {
  const scores: AxisScores = { P: 0, C: 0, S: 0, I: 0, B: 0, N: 0 };
  for (const answer of answers) {
    for (const [axis, value] of Object.entries(answer.scores)) {
      scores[axis as keyof AxisScores] += value ?? 0;
    }
  }
  return scores;
}

// スコアからタイプを決定
export function determineType(scores: AxisScores): CatTypeKey {
  const activity = scores.P >= scores.C ? "P" : "C";
  const social = scores.S >= scores.I ? "S" : "I";
  const nervous = scores.B >= scores.N ? "B" : "N";
  const axes = `${activity}${social}${nervous}` as
    | "PSB"
    | "PSN"
    | "PIB"
    | "PIN"
    | "CSB"
    | "CSN"
    | "CIB"
    | "CIN";

  const typeInfo = CAT_TYPES.find((type) => type.axes === axes);
  return typeInfo?.key ?? "luna";
}

// 行動・時間パターンを集計
export function calcActivityPattern(answers: AnswerOption[]): ActivityPattern {
  const peakTimes = answers
    .map((answer) => answer.peakTime)
    .filter(Boolean) as ActivityPattern["peakTime"][];

  const foodSensitivities = answers
    .map((answer) => answer.foodSensitivity)
    .filter(Boolean) as ActivityPattern["foodSensitivity"][];

  const stressSensitivities = answers
    .map((answer) => answer.stressSensitivity)
    .filter(Boolean) as ActivityPattern["stressSensitivity"][];

  return {
    peakTime: peakTimes[peakTimes.length - 1] ?? "random",
    foodSensitivity: foodSensitivities[foodSensitivities.length - 1] ?? "medium",
    stressSensitivity:
      stressSensitivities[stressSensitivities.length - 1] ?? "medium",
  };
}
