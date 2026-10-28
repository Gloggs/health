import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import {
  USERS,
  MEMBERSHIPS,
  FAMILIES,
  SLEEP_LOGS,
  MOOD_LOGS,
  WATER_LOGS,
  CARDIO_LOGS,
  BODY_METRICS,
  MEAL_LOGS,
  DAILY_MINI_LOGS,
  SESSIONS,
} from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";
import { computeAge } from "@/lib/age";
import { effectiveVisibility } from "@/lib/visibility";
import { computeStreak } from "@/lib/streak";
import { todayDateStr, weekStartStr, daysAgoStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

// GET /api/family
// Lists every family member with a thin motivation-strip payload:
// streak, completed-workouts-this-week, daily-mini-reps-today.
//
// Family scoping (F1 / B.3): the USERS list is joined with MEMBERSHIPS so
// only users belonging to the viewer's family appear. Each health-table
// scan additionally uses familyFilter (no-op when flag is off, cross-tenant
// safety when on).
export const GET = withFamily(async (_req, _ctx, { userId: viewerId, familyId }) => {
  const members = await db
    .select({
      id: USERS.id,
      email: USERS.email,
      displayName: USERS.displayName,
      dateOfBirth: USERS.dateOfBirth,
      heightCm: USERS.heightCm,
      visibility: USERS.visibility,
      lastActiveAt: USERS.lastActiveAt,
      role: MEMBERSHIPS.role,
    })
    .from(USERS)
    .innerJoin(MEMBERSHIPS, eq(MEMBERSHIPS.userId, USERS.id))
    .where(eq(MEMBERSHIPS.familyId, familyId))
    .orderBy(asc(USERS.createdAt));

  // Family metadata so the UI can render "The Smiths · 3 members" and gate
  // owner/admin actions like invite. Done in parallel with the heavier
  // health-stat scans below.
  const [familyRow] = await db
    .select({ id: FAMILIES.id, name: FAMILIES.name, ownerUserId: FAMILIES.ownerUserId })
    .from(FAMILIES)
    .where(eq(FAMILIES.id, familyId))
    .limit(1);
  const myRole =
    members.find((m) => m.id === viewerId)?.role ?? "member";

  if (members.length === 0) {
    return NextResponse.json({
      today: todayDateStr(),
      members: [],
      family: familyRow ?? null,
      myRole,
    });
  }
  const ids = members.map((m) => m.id);
  const today = todayDateStr();
  const weekStart = weekStartStr();

  const [
    sleepRows,
    moodRows,
    waterRows,
    cardioRows,
    bodyRows,
    mealRows,
    miniRows,
    sessionRows,
    weekCompletedRows,
    miniTodayRows,
  ] = await Promise.all([
    db
      .select({ userId: SLEEP_LOGS.userId, date: SLEEP_LOGS.date })
      .from(SLEEP_LOGS)
      .where(and(familyFilter(SLEEP_LOGS, familyId), inArray(SLEEP_LOGS.userId, ids))),
    db
      .select({
        userId: MOOD_LOGS.userId,
        date: MOOD_LOGS.date,
        mood: MOOD_LOGS.mood,
        energy: MOOD_LOGS.energy,
      })
      .from(MOOD_LOGS)
      .where(and(familyFilter(MOOD_LOGS, familyId), inArray(MOOD_LOGS.userId, ids))),
    db
      .select({ userId: WATER_LOGS.userId, date: WATER_LOGS.date })
      .from(WATER_LOGS)
      .where(and(familyFilter(WATER_LOGS, familyId), inArray(WATER_LOGS.userId, ids))),
    db
      .select({ userId: CARDIO_LOGS.userId, date: CARDIO_LOGS.date })
      .from(CARDIO_LOGS)
      .where(and(familyFilter(CARDIO_LOGS, familyId), inArray(CARDIO_LOGS.userId, ids))),
    db
      .select({
        userId: BODY_METRICS.userId,
        date: BODY_METRICS.date,
        weightKg: BODY_METRICS.weightKg,
      })
      .from(BODY_METRICS)
      .where(and(familyFilter(BODY_METRICS, familyId), inArray(BODY_METRICS.userId, ids))),
    db
      .select({ userId: MEAL_LOGS.userId, date: MEAL_LOGS.date })
      .from(MEAL_LOGS)
      .where(and(familyFilter(MEAL_LOGS, familyId), inArray(MEAL_LOGS.userId, ids))),
    db
      .select({
        userId: DAILY_MINI_LOGS.userId,
        date: DAILY_MINI_LOGS.date,
        count: DAILY_MINI_LOGS.count,
      })
      .from(DAILY_MINI_LOGS)
      .where(and(familyFilter(DAILY_MINI_LOGS, familyId), inArray(DAILY_MINI_LOGS.userId, ids))),
    db
      .select({
        userId: SESSIONS.userId,
        date: SESSIONS.date,
        completed: SESSIONS.completed,
      })
      .from(SESSIONS)
      .where(and(familyFilter(SESSIONS, familyId), inArray(SESSIONS.userId, ids))),
    db
      .select({
        userId: SESSIONS.userId,
        count: sql`COUNT(*)::int`.as("count"),
      })
      .from(SESSIONS)
      .where(
        and(
          familyFilter(SESSIONS, familyId),
          inArray(SESSIONS.userId, ids),
          eq(SESSIONS.completed, true),
          gte(SESSIONS.date, weekStart)
        )
      )
      .groupBy(SESSIONS.userId),
    db
      .select({
        userId: DAILY_MINI_LOGS.userId,
        total: sql`COALESCE(SUM(${DAILY_MINI_LOGS.count}), 0)::int`.as("total"),
      })
      .from(DAILY_MINI_LOGS)
      .where(
        and(
          familyFilter(DAILY_MINI_LOGS, familyId),
          inArray(DAILY_MINI_LOGS.userId, ids),
          eq(DAILY_MINI_LOGS.date, today)
        )
      )
      .groupBy(DAILY_MINI_LOGS.userId),
  ]);

  // Bucket activity dates per user. Mirrors the truth-table the Today page
  // uses so the streak is identical to what the user sees on their own dashboard.
  const byUser = new Map(ids.map((id) => [id, new Set()]));
  const add = (uid, d) => {
    const s = byUser.get(uid);
    if (s) s.add(d);
  };
  for (const r of sleepRows) add(r.userId, r.date);
  for (const r of moodRows) if (r.mood || r.energy) add(r.userId, r.date);
  for (const r of waterRows) add(r.userId, r.date);
  for (const r of cardioRows) add(r.userId, r.date);
  for (const r of bodyRows) if (r.weightKg) add(r.userId, r.date);
  for (const r of mealRows) add(r.userId, r.date);
  for (const r of miniRows) if (Number(r.count) > 0) add(r.userId, r.date);
  for (const r of sessionRows) if (r.completed) add(r.userId, r.date);

  const weekCompletedByUser = new Map(weekCompletedRows.map((r) => [r.userId, r.count]));
  const miniTodayByUser = new Map(miniTodayRows.map((r) => [r.userId, r.total]));

  // Build a count-per-day-per-member map for the last 7 days so the
  // family-page tiles can render a "▤▤▤▤_▤_" tally row. Each entry is
  // the count of distinct categories logged on that date. Drives the
  // M T W T F S S strip in SURFACES.md §3.
  //
  // Today is included as the rightmost slot; the seven days back from
  // today are computed in local time using daysAgoStr (already imported
  // via "@/lib/dates").
  // Categories that count per day (matching the streak truth table):
  //   sleep, mood (with mood or energy), water, cardio, body (with weight),
  //   meals, mini (>0), session (completed). Multiple logs of the same
  //   category on the same day count as 1.
  const lastSevenDays = [];
  for (let i = 6; i >= 0; i -= 1) {
    lastSevenDays.push(daysAgoStr(i));
  }
  // Build a per-(user, date) set of categories logged on that date.
  // Sub-map shape: Map<userId, Map<dateStr, Set<category>>>
  const byUserDate = new Map(ids.map((id) => [id, new Map()]));
  const ensureDateSet = (uid, d) => {
    const sub = byUserDate.get(uid);
    if (!sub) return null;
    let s = sub.get(d);
    if (!s) {
      s = new Set();
      sub.set(d, s);
    }
    return s;
  };
  const tagCat = (uid, d, cat) => {
    const set = ensureDateSet(uid, d);
    if (set) set.add(cat);
  };
  for (const r of sleepRows) tagCat(r.userId, r.date, "sleep");
  for (const r of moodRows) if (r.mood || r.energy) tagCat(r.userId, r.date, "mood");
  for (const r of waterRows) tagCat(r.userId, r.date, "water");
  for (const r of cardioRows) tagCat(r.userId, r.date, "cardio");
  for (const r of bodyRows) if (r.weightKg) tagCat(r.userId, r.date, "body");
  for (const r of mealRows) tagCat(r.userId, r.date, "meals");
  for (const r of miniRows) if (Number(r.count) > 0) tagCat(r.userId, r.date, "mini");
  for (const r of sessionRows) if (r.completed) tagCat(r.userId, r.date, "session");

  const out = members.map((m) => {
    const vis = effectiveVisibility(m.visibility);
    const isMe = m.id === viewerId;
    const showAge = isMe || vis.age;
    const showHeight = isMe || vis.height;
    return {
      id: m.id,
      email: isMe ? m.email : null,
      displayName: m.displayName,
      dateOfBirth: isMe ? m.dateOfBirth : null,
      age: showAge ? computeAge(m.dateOfBirth) : null,
      heightCm: showHeight ? (m.heightCm == null ? null : Number(m.heightCm)) : null,
      visibility: vis,
      lastActiveAt: m.lastActiveAt,
      isMe,
      role: m.role,
      streak: computeStreak(byUser.get(m.id) ?? new Set()),
      completedWorkoutsThisWeek: weekCompletedByUser.get(m.id) ?? 0,
      dailyMiniTodayTotal: miniTodayByUser.get(m.id) ?? 0,
      // Whether this member has logged anything today across the 7
      // tracked categories. Used by Today's family ribbon to render
      // ● (etched today) vs ○ (not yet). Cheap to compute since the
      // byUser activity-date set has already been built for the
      // streak calc above.
      etchedToday: (byUser.get(m.id) ?? new Set()).has(today),
      // Categories etched today (count). Used by Family page tile to
      // show "X of 7 etched today" per member.
      etchedTodayCount: (() => {
        const sub = byUserDate.get(m.id);
        const set = sub?.get(today);
        return set ? set.size : 0;
      })(),
      // 7-day rolling tally: each slot is the category-count for that
      // day. Used to render a glanceable strip per member. Indexed
      // oldest-first (6 days ago … today).
      last7DaysTally: lastSevenDays.map((d) => {
        const sub = byUserDate.get(m.id);
        const set = sub?.get(d);
        return set ? set.size : 0;
      }),
    };
  });

  return NextResponse.json({
    today,
    members: out,
    family: familyRow ?? null,
    myRole,
  });
});
