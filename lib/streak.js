import { dateStr } from "./dates";

/**
 * Count consecutive active days ending today (or yesterday, if today is empty).
 *
 * `activeDates` is a Set of YYYY-MM-DD strings (local timezone). Any day with
 * any logged activity - workout, sleep, mood, water, cardio, weight, meals,
 * daily-mini reps - counts. Today is checked first; if it's empty we count
 * back from yesterday so the streak doesn't break before you've logged today.
 *
 * Lives in /lib so the Today page (`app/dashboard/page.js`) and the Family
 * page (`app/dashboard/family/page.js`, server-side via `/api/family`) share
 * the same definition. Diverging from each other would make the same person
 * appear with two different streak numbers depending on which page you opened.
 *
 * Uses LOCAL date strings via `dateStr` - `toISOString().slice(0,10)` returns
 * UTC, which can shift by a day for users in non-UTC zones.
 */
export function computeStreak(activeDates, now = new Date()) {
  let streak = 0;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const cursor = new Date(d);
  if (!activeDates.has(dateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDates.has(dateStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
