// Daily 4 (mini-workout) defaults + helpers. Shared between the Today card
// and any settings UI so the labels stay consistent.

export const DEFAULT_MINI_EXERCISES = [
  { key: "pressups", label: "Press-ups", target: null },
  { key: "squats", label: "Squats", target: null },
  { key: "situps", label: "Sit-ups", target: null },
  { key: "jacks", label: "Jumping jacks", target: null },
];

// Validates a user-supplied array. Drops anything we don't recognise and
// pads/truncates to exactly 4 slots. Each slot needs a non-empty label;
// `key` is auto-derived from the label when missing.
export function normaliseMiniExercises(raw) {
  if (!Array.isArray(raw)) return DEFAULT_MINI_EXERCISES;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const item = raw[i];
    const fallback = DEFAULT_MINI_EXERCISES[i];
    if (!item || typeof item !== "object" || !item.label?.toString?.().trim()) {
      out.push(fallback);
      continue;
    }
    const label = String(item.label).trim().slice(0, 30);
    const key = item.key?.toString?.().trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, "");
    let target = null;
    if (item.target != null) {
      const t = Number(item.target);
      if (Number.isFinite(t) && t > 0) target = Math.floor(t);
    }
    out.push({ key, label, target });
  }
  return out;
}
