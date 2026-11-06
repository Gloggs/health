import test from "node:test";
import assert from "node:assert/strict";
import { buildSummary } from "../lib/summary.js";

const feelings = [
  { date: "2026-11-03", what: "Headache", whereOnBody: "Forehead", howBad: "mild", better: "Water", worse: "Screens", note: null },
  { date: "2026-11-05", what: "headache ", whereOnBody: "Forehead", howBad: "moderate", better: "water", worse: "Loud noise", note: "Woke up with it" },
  { date: "2026-11-05", what: "Sore knee", whereOnBody: null, howBad: null, better: null, worse: "Stairs", note: null },
  { date: "2026-10-01", what: "Old thing", whereOnBody: null, howBad: "bad", better: null, worse: null, note: null },
];
const base = { name: "Ada", today: "2026-11-06", from: "2026-10-23", to: "2026-11-06", feelings,
  sleep: [{ date: "2026-11-05", hours: "6.50", quality: 2 }], mood: [{ date: "2026-11-05", mood: 2, energy: 2 }],
  appointment: { date: "2026-11-10", questions: "Why does it keep coming back?\n\nShould I see someone?", medicines: "Paracetamol\nVitamin D" } };

test("groups by what was written, in date order, with since and the days written down", () => {
  const s = buildSummary(base);
  assert.deepEqual(s.happening.map((h) => [h.what, h.since, h.daysWritten]), [["Headache", "2026-11-03", 2], ["Sore knee", "2026-11-05", 1]]);
  assert.deepEqual(s.happening[0].entries.map((e) => e.howBad), ["mild", "moderate"]);
});

test("leaves out entries outside the period", () => {
  assert.equal(buildSummary(base).happening.some((h) => h.what === "Old thing"), false);
});

test("collects what helps and what makes it worse, without repeats", () => {
  const s = buildSummary(base);
  assert.deepEqual(s.better, ["Water"]);
  assert.deepEqual(s.worse, ["Screens", "Loud noise", "Stairs"]);
});

test("sleep and mood only on the days something was written down", () => {
  const s = buildSummary(base);
  assert.deepEqual(s.around, [{ date: "2026-11-05", sleep: { hours: 6.5, quality: 2 }, mood: { mood: "Meh", energy: "tired" } }]);
});

test("medicines and questions are the person's own lines", () => {
  const s = buildSummary(base);
  assert.deepEqual(s.medicines, ["Paracetamol", "Vitamin D"]);
  assert.deepEqual(s.questions, ["Why does it keep coming back?", "Should I see someone?"]);
});

test("adds no judgement: no scores, warnings or advice anywhere in what it builds", () => {
  const text = JSON.stringify(buildSummary(base)).toLowerCase();
  // The person's own question contains "should"; nothing the summary adds may.
  const added = text.replace("should i see someone?", "");
  for (const word of ["score", "risk", "serious", "urgent", "worsening", "improving", "diagnos", "you should", "we recommend", "normal", "abnormal"]) {
    assert.equal(added.includes(word), false, word);
  }
  assert.equal(buildSummary(base).footer, "These are my own words, written down using health. Your GP decides what this means.");
});
