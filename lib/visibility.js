/**
 * Per-user visibility model for the family-tenant rollout.
 *
 * Each family member has a `visibility` jsonb on their USERS row that
 * controls which sections of their dashboard are visible when someone
 * else views their profile (Phase 2). Journal/chat is never togglable -
 * it's always private. AI insights are not included because Claude is
 * being torn out entirely in Stage 6.
 */

// Private by default (6 November 2026, before opening sign-up to everyone): nothing is shared with the family
// until the person switches it on. Notes, tags and descriptions are never shared, whatever the switches say.
export const DEFAULT_VISIBILITY = {
  body: false,     // weight + waist/chest/arms/hips/thighs measurements
  age: false,
  height: false,
  sleep: false,    // bedtime, wake time, quality, hours
  mood: false,     // mood + energy ratings
  cardio: false,   // walks, runs, cycles
  meals: false,    // meal slots + quality scores (never the description)
  workouts: false, // per-set reps + weights
  water: false,    // glasses of water
  daily4: false,   // the Daily 4 counts
  streak: false,   // the streak and how many days you logged anything
};

// UI metadata for the toggle list - used by onboarding + Settings > Privacy.
// Order here is the order the toggles render in. Reorder thoughtfully.
export const VISIBILITY_SECTIONS = [
  {
    key: "body",
    label: "Body & weight",
    desc: "Weight, waist, chest, arm/hip/thigh measurements",
  },
  { key: "age", label: "Age", desc: "Your age in years" },
  { key: "height", label: "Height", desc: "Your height in centimetres" },
  {
    key: "sleep",
    label: "Sleep",
    desc: "Bedtime, wake time, quality, hours",
  },
  {
    key: "mood",
    label: "Mood & energy",
    desc: "Daily mood + energy ratings",
  },
  { key: "cardio", label: "Cardio", desc: "Walks, runs, cycles, swims" },
  { key: "meals", label: "Meals", desc: "What you ate + quality scores" },
  {
    key: "workouts",
    label: "Workouts",
    desc: "Sessions, sets, reps and weights",
  },
  { key: "water", label: "Water", desc: "How much water you drank" },
  { key: "daily4", label: "Daily 4", desc: "Your Daily 4 counts" },
  { key: "streak", label: "Streak and activity", desc: "Your streak, and on which days you logged something" },
];

const SECTION_KEYS = VISIBILITY_SECTIONS.map((s) => s.key);

/**
 * Coerce any input into a known-good visibility object. Missing keys fall
 * back to the default (off), unknown keys are dropped, values are
 * forced to booleans. Returns null only when caller passed null.
 */
export function normaliseVisibility(input) {
  if (input == null) return null;
  const out = {};
  for (const key of SECTION_KEYS) {
    out[key] = key in (input ?? {}) ? !!input[key] : DEFAULT_VISIBILITY[key];
  }
  return out;
}

/**
 * Returns the user's effective visibility flags, applying defaults where
 * the row has nothing set. Always safe to read all 8 keys off the result.
 */
export function effectiveVisibility(input) {
  if (input == null) return { ...DEFAULT_VISIBILITY };
  return { ...DEFAULT_VISIBILITY, ...normaliseVisibility(input) };
}

// Words a person wrote about themselves. Never sent to anyone else, whatever their switches say.
const PRIVATE_TEXT = ["note", "notes", "tags", "description", "content", "redacted"];

/** A copy of a row without the person's own words, for when someone else is viewing it. */
export function numbersOnly(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const k of PRIVATE_TEXT) if (k in out) delete out[k];
  return out;
}
