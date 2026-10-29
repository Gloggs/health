import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliseContainers,
  normaliseTags,
  timeToMinutes,
  minutesToTime,
  sleepMinutes,
  usualTime,
  usualSleep,
  topValues,
  cardioUsuals,
  mealUsuals,
  defaultMealSlot,
  moodTagUsuals,
  DEFAULT_CONTAINERS,
} from "../lib/usuals.js";

test("containers fall back to the defaults and are clamped", () => {
  assert.deepEqual(normaliseContainers(null), DEFAULT_CONTAINERS);
  assert.deepEqual(normaliseContainers([{ name: "  Flask ", ml: 750 }, { name: "", ml: 300 }, { name: "Tiny", ml: 10 }]), [
    { name: "Flask", ml: 750 },
  ]);
  assert.equal(normaliseContainers(Array.from({ length: 9 }, (_, i) => ({ name: `C${i}`, ml: 100 }))).length, 6);
});

test("tags are trimmed, de-duplicated and capped", () => {
  assert.deepEqual(normaliseTags([" Work ", "work", "Family", "", null]), ["Work", "Family"]);
  assert.equal(normaliseTags(Array.from({ length: 12 }, (_, i) => `t${i}`)).length, 8);
  assert.deepEqual(normaliseTags("Work"), []);
});

test("clock times convert both ways and wrap", () => {
  assert.equal(timeToMinutes("23:10"), 1390);
  assert.equal(timeToMinutes("7:05"), 425);
  assert.equal(timeToMinutes("25:00"), null);
  assert.equal(minutesToTime(1390), "23:10");
  assert.equal(minutesToTime(1450), "00:10");
  assert.equal(minutesToTime(-15), "23:45");
});

test("sleep length crosses midnight", () => {
  assert.equal(sleepMinutes("23:10", "06:30"), 440);
  assert.equal(sleepMinutes("01:00", "08:00"), 420);
  assert.equal(sleepMinutes("22:00", "22:00"), null);
  assert.equal(sleepMinutes(null, "06:00"), null);
});

test("usual bedtime treats times either side of midnight as close", () => {
  assert.equal(usualTime(["23:30", "00:15", "23:50"], "12:00"), "23:50");
  assert.equal(usualTime(["23:58", "00:02"], "12:00"), "00:00");
  assert.equal(usualTime([], "12:00"), null);
});

test("usual sleep uses the latest fourteen complete nights", () => {
  const rows = [
    { bedtime: "23:00", wakeTime: "06:30" },
    { bedtime: "23:20", wakeTime: "06:40" },
    { bedtime: null, wakeTime: "07:00" },
    { bedtime: "22:50", wakeTime: "06:35" },
  ];
  assert.deepEqual(usualSleep(rows), { bedtime: "23:00", wakeTime: "06:35" });
  assert.equal(usualSleep([]), null);
});

test("top values prefer frequency, then recency", () => {
  assert.deepEqual(topValues(["b", "a", "a", "c", "b", "a"], 2), ["a", "b"]);
  assert.deepEqual(topValues(["x", "y"], 3), ["x", "y"]);
});

test("cardio usuals group by type and duration", () => {
  const rows = [
    { type: "Run", durationMinutes: 30, distanceKm: "5.2" },
    { type: "Walk", durationMinutes: 15 },
    { type: "run", durationMinutes: 30, distanceKm: "5.0" },
  ];
  assert.deepEqual(cardioUsuals(rows), [
    { type: "Run", durationMinutes: 30, distanceKm: 5.2 },
    { type: "Walk", durationMinutes: 15, distanceKm: null },
  ]);
});

test("meal usuals are per slot and ignore case", () => {
  const rows = [
    { slot: "dinner", description: "Chicken and rice" },
    { slot: "lunch", description: "Soup" },
    { slot: "dinner", description: "chicken and rice " },
    { slot: "dinner", description: "Jollof" },
  ];
  assert.deepEqual(mealUsuals(rows, "dinner"), ["Chicken and rice", "Jollof"]);
});

test("meal slot follows the time of day", () => {
  assert.equal(defaultMealSlot(7), "breakfast");
  assert.equal(defaultMealSlot(12), "lunch");
  assert.equal(defaultMealSlot(16), "snack");
  assert.equal(defaultMealSlot(19), "dinner");
  assert.equal(defaultMealSlot(23), "snack");
});

test("mood tags put your own first, then fill with defaults", () => {
  const tags = moodTagUsuals([{ tags: ["Church", "Work"] }, { tags: ["Church"] }], 4);
  assert.deepEqual(tags, ["Church", "Work", "Training", "Sleep"]);
});
