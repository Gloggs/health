/**
 * lib/format.js — single source of truth for every metric in Health.
 *
 * Why this file exists:
 *   Before unification, sleep showed "5.73h" on Today, "5.7h" on Trends,
 *   and "5h 44m" in a tooltip — three formats for the same fact. Numbers
 *   are the brand. They have to feel inevitable, not improvised.
 *
 * Rules of thumb (BRAND.md §Numbers):
 *   - Hours-and-minutes are written as "5h 44m" or "5h" or "44m".
 *     Never decimal hours in body copy. Tight chart axes/tooltips can use
 *     `hoursDecimal` where space demands it.
 *   - Weight is one decimal: "158.4 kg". Always lowercase unit. Comma‑free.
 *   - Water uses smart unit picking: <1000 ml shows ml ("750 ml"),
 *     ≥ 1000 ml shows L with one decimal ("1.5L"). Glyph is uppercase L
 *     because the lowercase "l" looks like a 1.
 *   - Mood / quality are "3.6 / 5" (slash with thin spaces).
 *   - Counts use comma grouping at 1000+ ("1,234 reps").
 *   - Percentages are integers ("73%") — decimals make the user feel
 *     surveilled.
 *   - Deltas always carry a sign: "+1.2 kg" / "-1.2 kg" — never "↑" arrows
 *     (kept those for ad-hoc display but the formatter stays neutral).
 *
 * Every formatter is null-safe: pass undefined, null, NaN, or 0 and the
 * fallback string (default "—") comes back. Callers don't have to guard.
 */

const DASH = "-";

function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/* =========================================================================
 *  Time / duration
 * ========================================================================= */

/**
 * Convert a decimal hours value to "5h 44m" / "5h" / "44m".
 * Rounds to the nearest minute, drops zero parts.
 *
 *   formatDuration(5.73)  → "5h 44m"
 *   formatDuration(8)     → "8h"
 *   formatDuration(0.5)   → "30m"
 *   formatDuration(0)     → "0m"
 *   formatDuration(null)  → "—"
 */
export function formatDuration(hoursDecimal, { fallback = DASH } = {}) {
  const n = toFiniteNumber(hoursDecimal);
  if (n === null) return fallback;
  if (n === 0) return "0m";

  const totalMinutes = Math.round(n * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Same source as `formatDuration` but expressed as one decimal hour for
 * chart axes / tooltips where space is tight. Always carries the "h".
 *
 *   formatHoursDecimal(5.73) → "5.7h"
 *   formatHoursDecimal(8)    → "8.0h"
 */
export function formatHoursDecimal(hoursDecimal, { fallback = DASH } = {}) {
  const n = toFiniteNumber(hoursDecimal);
  if (n === null) return fallback;
  return `${n.toFixed(1)}h`;
}

/**
 * Format a minutes value. Used for cardio durations.
 *
 *   formatMinutes(45)  → "45 min"
 *   formatMinutes(75)  → "1h 15m"
 *   formatMinutes(0)   → "0 min"
 */
export function formatMinutes(minutes, { fallback = DASH } = {}) {
  const n = toFiniteNumber(minutes);
  if (n === null) return fallback;
  if (n === 0) return "0 min";
  if (n < 60) return `${Math.round(n)} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* =========================================================================
 *  Weight
 * ========================================================================= */

/**
 *   formatWeight(158.4)  → "158.4 kg"
 *   formatWeight(80)     → "80.0 kg"
 *   formatWeight(null)   → "—"
 */
export function formatWeight(kg, { fallback = DASH } = {}) {
  const n = toFiniteNumber(kg);
  if (n === null) return fallback;
  return `${n.toFixed(1)} kg`;
}

/**
 *   formatWeightDelta(1.2)   → "+1.2 kg"
 *   formatWeightDelta(-1.2)  → "-1.2 kg"
 *   formatWeightDelta(0)     → "±0.0 kg"
 */
export function formatWeightDelta(deltaKg, { fallback = DASH } = {}) {
  const n = toFiniteNumber(deltaKg);
  if (n === null) return fallback;
  if (n === 0) return "±0.0 kg";
  const sign = n > 0 ? "+" : "-";
  return `${sign}${Math.abs(n).toFixed(1)} kg`;
}

/* =========================================================================
 *  Water
 * ========================================================================= */

/**
 * Smart unit-picking water formatter. Use this in display contexts where
 * one big number reads better than "1240 ml". For tooltips / log history
 * where ml precision matters, use `formatMl`.
 *
 *   formatWater(750)   → "750 ml"
 *   formatWater(1500)  → "1.5L"
 *   formatWater(2000)  → "2L"
 *   formatWater(0)     → "0 ml"
 */
export function formatWater(ml, { fallback = DASH } = {}) {
  const n = toFiniteNumber(ml);
  if (n === null) return fallback;
  if (n === 0) return "0 ml";
  if (Math.abs(n) < 1000) return `${Math.round(n)} ml`;
  const litres = n / 1000;
  if (Number.isInteger(litres)) return `${litres}L`;
  return `${litres.toFixed(1)}L`;
}

/**
 * Always-ml formatter with comma grouping at 1000+.
 *
 *   formatMl(750)   → "750 ml"
 *   formatMl(1500)  → "1,500 ml"
 */
export function formatMl(ml, { fallback = DASH } = {}) {
  const n = toFiniteNumber(ml);
  if (n === null) return fallback;
  return `${Math.round(n).toLocaleString("en-GB")} ml`;
}

/* =========================================================================
 *  Scores / quality / percentages
 * ========================================================================= */

/**
 * Score out of 5, one decimal. Used for mood, sleep quality, etc.
 *
 *   formatScoreOf5(3.6)  → "3.6 / 5"
 *   formatScoreOf5(5)    → "5.0 / 5"
 */
export function formatScoreOf5(score, { fallback = DASH } = {}) {
  const n = toFiniteNumber(score);
  if (n === null) return fallback;
  return `${n.toFixed(1)} / 5`;
}

/**
 * Score out of 10, one decimal. Used for follow-through / discipline.
 *
 *   formatScoreOf10(7.2)  → "7.2 / 10"
 */
export function formatScoreOf10(score, { fallback = DASH } = {}) {
  const n = toFiniteNumber(score);
  if (n === null) return fallback;
  return `${n.toFixed(1)} / 10`;
}

/**
 *   formatPercent(73.4)  → "73%"
 *   formatPercent(100)   → "100%"
 *   formatPercent(null)  → "—"
 */
export function formatPercent(value, { fallback = DASH } = {}) {
  const n = toFiniteNumber(value);
  if (n === null) return fallback;
  return `${Math.round(n)}%`;
}

/* =========================================================================
 *  Generic counts
 * ========================================================================= */

/**
 * Comma-grouped integer. Used for rep counts, family member counts, etc.
 *
 *   formatCount(1234)  → "1,234"
 *   formatCount(7)     → "7"
 */
export function formatCount(value, { fallback = DASH } = {}) {
  const n = toFiniteNumber(value);
  if (n === null) return fallback;
  return Math.round(n).toLocaleString("en-GB");
}

/**
 * Singular / plural picker for inline counts.
 *
 *   pluralize(1, "pour", "pours") → "1 pour"
 *   pluralize(3, "pour", "pours") → "3 pours"
 */
export function pluralize(n, singular, plural) {
  const num = toFiniteNumber(n);
  if (num === null) return `0 ${plural}`;
  return `${Math.round(num)} ${num === 1 ? singular : plural}`;
}

/* =========================================================================
 *  Time-of-day (24h → "07:15")
 * ========================================================================= */

/**
 * Pass a Date or an ISO string; get back a UK-style 24-hour clock label.
 *   formatTime("2026-05-23T07:15:00Z")  → "07:15"
 */
export function formatTime(input, { fallback = DASH } = {}) {
  if (!input) return fallback;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
