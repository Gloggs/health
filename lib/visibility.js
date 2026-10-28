/**
 * Per-user visibility model for the family-tenant rollout.
 *
 * Each family member has a `visibility` jsonb on their USERS row that
 * controls which sections of their dashboard are visible when someone
 * else views their profile (Phase 2). Journal/chat is never togglable -
 * it's always private. AI insights are not included because Claude is
 * being torn out entirely in Stage 6.
 */

export const DEFAULT_VISIBILITY = {
  body: true,     // weight + waist/chest/arms/hips/thighs measurements
  age: true,
  height: true,
  sleep: true,    // bedtime, wake time, quality
  mood: true,     // mood + energy ratings
  cardio: true,   // walks, runs, cycles
  meals: true,    // meal slots + quality scores
  workouts: true, // detailed per-set reps + weights (the streak/completed-count
                  // header is ALWAYS visible regardless of this toggle)
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
    label: "Detailed workouts",
    desc: "Per-set reps, weights. Completed-session counts stay visible either way.",
  },
];

const SECTION_KEYS = VISIBILITY_SECTIONS.map((s) => s.key);

/**
 * Coerce any input into a known-good visibility object. Missing keys fall
 * back to the default (all on), unknown keys are dropped, values are
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
