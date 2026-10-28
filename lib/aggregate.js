// Pure-function helpers for charting aggregations.
// All functions take a date range (inclusive) and an array of rows; they
// return a dense series so charts don't have gaps.

import { dateStr, addDays } from "./dates";

// Build a YYYY-MM-DD list across the inclusive range [from, to].
export function denseDates(from, to) {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const out = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    out.push(dateStr(d));
  }
  return out;
}

// Returns the Monday (ISO Mon=0) of the week containing `dateString`, as YYYY-MM-DD.
function mondayOf(dateString) {
  const d = new Date(dateString + "T00:00:00");
  const idx = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - idx);
  return dateStr(d);
}

// Dense per-day series: { date, value } picking value via getter (or null).
export function daily(rows, from, to, getter) {
  const byDate = new Map();
  for (const r of rows) byDate.set(r.date, getter(r));
  return denseDates(from, to).map((d) => ({
    date: d,
    value: byDate.has(d) ? byDate.get(d) : null,
  }));
}

// Dense per-day series that sums a numeric field across all rows for that date.
export function dailySum(rows, from, to, fieldOrFn) {
  const byDate = new Map();
  const fn = typeof fieldOrFn === "function" ? fieldOrFn : (r) => Number(r[fieldOrFn] ?? 0);
  for (const r of rows) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + fn(r));
  }
  return denseDates(from, to).map((d) => ({
    date: d,
    value: byDate.has(d) ? byDate.get(d) : 0,
  }));
}

// Aggregate rows into weekly buckets keyed by Monday. fn = (rowsInWeek) => value
export function weekly(rows, from, to, fn) {
  const buckets = new Map();
  for (const r of rows) {
    const k = mondayOf(r.date);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(r);
  }
  // dense weeks across the range
  const startMonday = mondayOf(from);
  const endMonday = mondayOf(to);
  const out = [];
  let cursor = new Date(startMonday + "T00:00:00");
  const end = new Date(endMonday + "T00:00:00");
  while (cursor <= end) {
    const k = dateStr(cursor);
    out.push({ weekStart: k, value: fn(buckets.get(k) ?? []) });
    cursor = addDays(cursor, 7);
  }
  return out;
}

export function mean(arr) {
  const xs = arr.filter((x) => x !== null && x !== undefined && !Number.isNaN(x));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + Number(b), 0) / xs.length;
}

// Trailing simple moving average over a daily series [{date, value}] where
// `value` can be null for gap days. Returns the same shape; the average at
// each point is taken over the last `window` non-null values up to and
// including the point. Useful for smoothing sparse signals like body weight.
export function movingAverage(series, window) {
  if (window < 1) return series.map((d) => ({ date: d.date, value: null }));
  const out = [];
  for (let i = 0; i < series.length; i++) {
    const slice = [];
    for (let j = i; j >= 0 && slice.length < window; j--) {
      const v = series[j].value;
      if (v != null && !Number.isNaN(Number(v))) slice.push(Number(v));
    }
    out.push({
      date: series[i].date,
      value: slice.length === 0 ? null : slice.reduce((s, v) => s + v, 0) / slice.length,
    });
  }
  return out;
}
