import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { applyDiagnosisFeedback } from "../../understanding/feedback";
import type { CategoryScores, CauseCategory } from "../../types";
import { decideCategories } from "../decision";
import { calculateScores } from "../scoring";
import { resetMemoryWeights } from "../weights";

beforeEach(() => {
  resetMemoryWeights();
});

test("night meowing with food five hours ago ranks food first", () => {
  const scores = calculateScores("meowing", {
    time: "night",
    lastFoodMinutes: 300,
  });

  assert.equal(topCategory(scores), "food");
  assert.deepEqual(decideCategories(scores), ["food", "play"]);
});

test("night meowing soon after food and no recent play ranks play first", () => {
  const scores = calculateScores("meowing", {
    time: "night",
    lastFoodMinutes: 30,
    lastPlayMinutes: 420,
  });

  assert.equal(topCategory(scores), "play");
});

test("following ranks social first", () => {
  const scores = calculateScores("following");

  assert.equal(topCategory(scores), "social");
});

test("low energy prioritizes health", () => {
  const scores = calculateScores("low_energy", {
    time: "night",
  });

  assert.deepEqual(decideCategories(scores), ["health"]);
});

test("fighting ranks stress first", () => {
  const scores = calculateScores("fighting");

  assert.equal(topCategory(scores), "stress");
});

test("restless returns play and stress when the score difference is ten", () => {
  const scores = calculateScores("restless");

  assert.deepEqual(decideCategories(scores), ["play", "stress"]);
});

test("late-night meowing does not over-strengthen food", () => {
  const scores = calculateScores("meowing", {
    time: "late_night",
  });

  assert.notEqual(topCategory(scores), "food");
  assert.ok(scores.food <= scores.social);
});

test("resolved feedback raises the same category score next time", () => {
  const before = calculateScores("following");

  applyDiagnosisFeedback("social", "resolved");

  const after = calculateScores("following");

  assert.equal(after.social, before.social + 10);
});

test("unresolved feedback lowers the same category score next time", () => {
  const before = calculateScores("following");

  applyDiagnosisFeedback("social", "unresolved");

  const after = calculateScores("following");

  assert.equal(after.social, before.social - 10);
});

function topCategory(scores: CategoryScores): CauseCategory {
  return (Object.entries(scores) as [CauseCategory, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0][0];
}
