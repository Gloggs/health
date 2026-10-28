/**
 * "Usuals": the shortcuts the log sheet offers, worked out from a person's
 * own history instead of fixed amounts. Pure functions with no imports, so
 * they run the same in the browser, on the server and in `node --test`.
 */

export const DEFAULT_CONTAINERS = [
  { name: "Glass", ml: 250 },
  { name: "Bottle", ml: 500 },
  { name: "Mug", ml: 330 },
];

export const DEFAULT_MOOD_TAGS = ["Training", "Work", "Sleep", "Family", "Food", "Stress", "Friends", "Outdoors"];

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"];

/** Up to six named containers, 50 ml to 2 litres each. Falls back to the defaults. */
export function normaliseContainers(input) {
  if (!Array.isArray(input)) return DEFAULT_CONTAINERS.map((c) => ({ ...c }));
  const out = [];
  for (const c of input) {
    const name = String(c?.name ?? "").trim().slice(0, 20);
    const ml = Math.round(Number(c?.ml));
    if (!name || !Number.isFinite(ml) || ml < 50 || ml > 2000) continue;
    out.push({ name, ml });
    if (out.length === 6) break;
  }
  return out.length ? out : DEFAULT_CONTAINERS.map((c) => ({ ...c }));
}

/** Up to eight short tags, trimmed, without case-insensitive duplicates. */
export function normaliseTags(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const t of input) {
    const tag = String(t ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === 8) break;
  }
  return out;
}

/** "23:10" -> 1390. Returns null for anything that is not HH:MM. */
export function timeToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? ""));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 1390 -> "23:10". Wraps past midnight in either direction. */
export function minutesToTime(total) {
  const m = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes asleep between a bedtime and a wake time, across midnight if needed. */
export function sleepMinutes(bedtime, wakeTime) {
  const b = timeToMinutes(bedtime);
  const w = timeToMinutes(wakeTime);
  if (b == null || w == null) return null;
  const diff = (w - b + 1440) % 1440;
  return diff === 0 ? null : diff;
}

/**
 * The middle time of a list of clock times. Bedtimes straddle midnight
 * (23:30 and 00:15 are close, not 23 hours apart), so times before `pivot`
 * count as the next day before taking the median.
 */
export function usualTime(times, pivot = "12:00", step = 5) {
  const p = timeToMinutes(pivot);
  const mins = times
    .map(timeToMinutes)
    .filter((m) => m != null)
    .map((m) => (m < p ? m + 1440 : m))
    .sort((a, b) => a - b);
  if (!mins.length) return null;
  const mid = mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2;
  return minutesToTime(Math.round(mid / step) * step);
}

/** Usual bedtime and wake time from the most recent fourteen nights. */
export function usualSleep(rows) {
  const recent = (rows ?? []).filter((r) => r?.bedtime && r?.wakeTime).slice(0, 14);
  if (!recent.length) return null;
  return {
    bedtime: usualTime(recent.map((r) => r.bedtime), "12:00"),
    wakeTime: usualTime(recent.map((r) => r.wakeTime), "00:00"),
  };
}

/**
 * The most frequent values, most frequent first. Ties go to whichever was
 * used most recently, so `values` must be in newest-first order.
 */
export function topValues(values, n = 3, keyOf = (v) => v) {
  const counts = new Map();
  values.forEach((v, i) => {
    const k = keyOf(v);
    if (k == null || k === "") return;
    const cur = counts.get(k);
    if (cur) cur.count += 1;
    else counts.set(k, { value: v, count: 1, first: i });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, n)
    .map((x) => x.value);
}

/** Usual cardio sessions: the most common type and duration pairs. */
export function cardioUsuals(rows, n = 2) {
  const list = (rows ?? []).filter((r) => r?.type && r?.durationMinutes).slice(0, 40);
  return topValues(list, n, (r) => `${String(r.type).toLowerCase()}|${r.durationMinutes}`).map((r) => ({
    type: r.type,
    durationMinutes: Number(r.durationMinutes),
    distanceKm: r.distanceKm == null ? null : Number(r.distanceKm),
  }));
}

/** Usual meals for one slot, by description. */
export function mealUsuals(rows, slot, n = 3) {
  const list = (rows ?? []).filter((r) => r?.slot === slot && r?.description).slice(0, 60);
  return topValues(list, n, (r) => String(r.description).trim().toLowerCase()).map((r) => String(r.description).trim());
}

/** Which meal it probably is, from the hour of the day. */
export function defaultMealSlot(hour) {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

/** Tags offered on the mood sheet: the person's own most used, then the defaults. */
export function moodTagUsuals(rows, n = 10) {
  const used = topValues(
    (rows ?? []).flatMap((r) => (Array.isArray(r?.tags) ? r.tags : [])),
    n,
    (t) => String(t).toLowerCase()
  );
  const seen = new Set(used.map((t) => t.toLowerCase()));
  const out = [...used];
  for (const t of DEFAULT_MOOD_TAGS) {
    if (out.length >= n) break;
    if (!seen.has(t.toLowerCase())) out.push(t);
  }
  return out;
}
