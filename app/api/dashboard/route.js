import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import {
  SLEEP_LOGS,
  WATER_LOGS,
  MOOD_LOGS,
  BODY_METRICS,
  CARDIO_LOGS,
  MEAL_LOGS,
  DAILY_CHECK_INS,
  DAILY_MINI_LOGS,
  SESSIONS,
  SESSION_SETS,
  PLANS,
  PLAN_DAYS,
  PLAN_EXERCISES,
  EXERCISES,
  USER_CONTEXT,
  USERS,
} from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";
import { computeStreak } from "@/lib/streak";

// Today changes every request and the Today screen is THE primary surface.
// Never prerender; always read live state in one round trip.
export const dynamic = "force-dynamic";

function todayDayIndex() {
  return (new Date().getDay() + 6) % 7;
}
function todayDateStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// GET /api/dashboard
// One round trip for everything Today + onboarding need. Every query is
// scoped to viewingId (the user being shown, self by default) AND when
// the workspace flag is on, to the viewer's familyId. In viewing-other
// mode, the auth layer already guarantees the viewee shares the same
// family, so the familyId scope is consistent across viewer + viewee.
export const GET = withFamily(async (req, _ctx, auth) => {
  const { viewingId, isViewingOther, vieweeVisibility, familyId } = auth;
  const sp = req.nextUrl.searchParams;

  // Pull the viewee's displayName so the viewing-mode Today layout can say
  // "Mum's day" without a second API round-trip. Skipped on self-view -
  // the client already knows its own name from Kinde.
  let viewee = null;
  if (isViewingOther) {
    const [row] = await db
      .select({ id: USERS.id, displayName: USERS.displayName })
      .from(USERS)
      .where(eq(USERS.id, viewingId))
      .limit(1);
    if (row) viewee = row;
  }
  const supplied = sp.get("d");
  const date = supplied && /^\d{4}-\d{2}-\d{2}$/.test(supplied) ? supplied : todayDateStr();
  const dayIndex = supplied && /^\d{4}-\d{2}-\d{2}$/.test(supplied)
    ? ((new Date(supplied + "T00:00:00").getDay() + 6) % 7)
    : todayDayIndex();

  const [
    activeRaw,
    todaySleep,
    todayWaterRows,
    todayMood,
    todayCheckIn,
    todayCardio,
    todaySession,
    allSleep,
    allMood,
    allWaterAgg,
    allCardio,
    allBody,
    allSessions,
    userCtx,
    exerciseMaxRows,
    todayMeals,
    allMeals,
    todayMini,
    allMini,
  ] = await Promise.all([
    db
      .select()
      .from(PLANS)
      .where(and(familyFilter(PLANS, familyId), eq(PLANS.userId, viewingId), eq(PLANS.isActive, true)))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(SLEEP_LOGS)
      .where(and(familyFilter(SLEEP_LOGS, familyId), eq(SLEEP_LOGS.userId, viewingId), eq(SLEEP_LOGS.date, date)))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(WATER_LOGS)
      .where(and(familyFilter(WATER_LOGS, familyId), eq(WATER_LOGS.userId, viewingId), eq(WATER_LOGS.date, date)))
      .orderBy(desc(WATER_LOGS.createdAt)),
    db
      .select()
      .from(MOOD_LOGS)
      .where(and(familyFilter(MOOD_LOGS, familyId), eq(MOOD_LOGS.userId, viewingId), eq(MOOD_LOGS.date, date)))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(DAILY_CHECK_INS)
      .where(and(familyFilter(DAILY_CHECK_INS, familyId), eq(DAILY_CHECK_INS.userId, viewingId), eq(DAILY_CHECK_INS.date, date)))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(CARDIO_LOGS)
      .where(and(familyFilter(CARDIO_LOGS, familyId), eq(CARDIO_LOGS.userId, viewingId), eq(CARDIO_LOGS.date, date)))
      .orderBy(desc(CARDIO_LOGS.createdAt)),
    db
      .select()
      .from(SESSIONS)
      .where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.userId, viewingId), eq(SESSIONS.date, date)))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(SLEEP_LOGS)
      .where(and(familyFilter(SLEEP_LOGS, familyId), eq(SLEEP_LOGS.userId, viewingId)))
      .orderBy(desc(SLEEP_LOGS.date)),
    db
      .select()
      .from(MOOD_LOGS)
      .where(and(familyFilter(MOOD_LOGS, familyId), eq(MOOD_LOGS.userId, viewingId)))
      .orderBy(desc(MOOD_LOGS.date)),
    db
      .select({
        date: WATER_LOGS.date,
        totalMl: sql`sum(${WATER_LOGS.amountMl})::int`.as("total_ml"),
      })
      .from(WATER_LOGS)
      .where(and(familyFilter(WATER_LOGS, familyId), eq(WATER_LOGS.userId, viewingId)))
      .groupBy(WATER_LOGS.date)
      .orderBy(desc(WATER_LOGS.date)),
    db
      .select()
      .from(CARDIO_LOGS)
      .where(and(familyFilter(CARDIO_LOGS, familyId), eq(CARDIO_LOGS.userId, viewingId)))
      .orderBy(desc(CARDIO_LOGS.date), desc(CARDIO_LOGS.createdAt)),
    db
      .select()
      .from(BODY_METRICS)
      .where(and(familyFilter(BODY_METRICS, familyId), eq(BODY_METRICS.userId, viewingId)))
      .orderBy(desc(BODY_METRICS.date)),
    db
      .select({
        id: SESSIONS.id,
        date: SESSIONS.date,
        planDayId: SESSIONS.planDayId,
        completed: SESSIONS.completed,
        durationMinutes: SESSIONS.durationMinutes,
        notes: SESSIONS.notes,
        createdAt: SESSIONS.createdAt,
        planDayLabel: PLAN_DAYS.label,
      })
      .from(SESSIONS)
      .leftJoin(PLAN_DAYS, eq(PLAN_DAYS.id, SESSIONS.planDayId))
      .where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.userId, viewingId)))
      .orderBy(desc(SESSIONS.date)),
    db
      .select()
      .from(USER_CONTEXT)
      .where(and(familyFilter(USER_CONTEXT, familyId), eq(USER_CONTEXT.userId, viewingId)))
      .limit(1)
      .then((r) => r[0] ?? null),
    // Lifetime max weight per exercise for THIS user - drives PR detection on Today.
    db
      .select({
        exerciseId: SESSION_SETS.exerciseId,
        maxWeight: sql`MAX(${SESSION_SETS.weight}::numeric)`.as("max_weight"),
      })
      .from(SESSION_SETS)
      .where(and(familyFilter(SESSION_SETS, familyId), eq(SESSION_SETS.userId, viewingId), isNotNull(SESSION_SETS.weight)))
      .groupBy(SESSION_SETS.exerciseId),
    db
      .select()
      .from(MEAL_LOGS)
      .where(and(familyFilter(MEAL_LOGS, familyId), eq(MEAL_LOGS.userId, viewingId), eq(MEAL_LOGS.date, date)))
      .orderBy(asc(MEAL_LOGS.createdAt)),
    db
      .select()
      .from(MEAL_LOGS)
      .where(and(familyFilter(MEAL_LOGS, familyId), eq(MEAL_LOGS.userId, viewingId)))
      .orderBy(desc(MEAL_LOGS.date), desc(MEAL_LOGS.createdAt)),
    db
      .select()
      .from(DAILY_MINI_LOGS)
      .where(and(familyFilter(DAILY_MINI_LOGS, familyId), eq(DAILY_MINI_LOGS.userId, viewingId), eq(DAILY_MINI_LOGS.date, date)))
      .orderBy(asc(DAILY_MINI_LOGS.slot)),
    db
      .select()
      .from(DAILY_MINI_LOGS)
      .where(and(familyFilter(DAILY_MINI_LOGS, familyId), eq(DAILY_MINI_LOGS.userId, viewingId)))
      .orderBy(desc(DAILY_MINI_LOGS.date), asc(DAILY_MINI_LOGS.slot)),
  ]);

  // Auto-expire one-off plans whose 7-day window has passed (scoped to this user).
  // Skipped in viewing-other mode - we'd otherwise mutate the viewee's plan
  // from the viewer's session. The viewee's own next visit will auto-expire it.
  let plan = activeRaw;
  if (
    !isViewingOther &&
    plan &&
    plan.repeatWeekly === false &&
    plan.activatedAt &&
    Date.now() - new Date(plan.activatedAt).getTime() > 7 * 24 * 60 * 60 * 1000
  ) {
    await db
      .update(PLANS)
      .set({ isActive: false })
      .where(and(familyFilter(PLANS, familyId), eq(PLANS.id, plan.id), eq(PLANS.userId, viewingId)));
    plan = null;
  }

  let planDay = null;
  let exercises = [];
  let planDays = [];
  if (plan) {
    planDays = await db
      .select({ id: PLAN_DAYS.id, dayIndex: PLAN_DAYS.dayIndex, label: PLAN_DAYS.label })
      .from(PLAN_DAYS)
      .where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.userId, viewingId), eq(PLAN_DAYS.planId, plan.id)))
      .orderBy(asc(PLAN_DAYS.dayIndex));
    planDay = planDays.find((d) => d.dayIndex === dayIndex) ?? null;
    if (planDay) {
      exercises = await db
        .select({
          id: PLAN_EXERCISES.id,
          exerciseId: PLAN_EXERCISES.exerciseId,
          position: PLAN_EXERCISES.position,
          targetSets: PLAN_EXERCISES.targetSets,
          targetReps: PLAN_EXERCISES.targetReps,
          targetWeight: PLAN_EXERCISES.targetWeight,
          targetDurationMinutes: PLAN_EXERCISES.targetDurationMinutes,
          targetDistanceKm: PLAN_EXERCISES.targetDistanceKm,
          notes: PLAN_EXERCISES.notes,
          name: EXERCISES.name,
          muscleGroup: EXERCISES.muscleGroup,
          equipment: EXERCISES.equipment,
        })
        .from(PLAN_EXERCISES)
        .leftJoin(EXERCISES, eq(EXERCISES.id, PLAN_EXERCISES.exerciseId))
        .where(
          and(familyFilter(PLAN_EXERCISES, familyId), eq(PLAN_EXERCISES.userId, viewingId), eq(PLAN_EXERCISES.planDayId, planDay.id))
        )
        .orderBy(asc(PLAN_EXERCISES.position));
    }
  }

  let todaySets = [];
  if (todaySession) {
    todaySets = await db
      .select({
        id: SESSION_SETS.id,
        sessionId: SESSION_SETS.sessionId,
        exerciseId: SESSION_SETS.exerciseId,
        setNumber: SESSION_SETS.setNumber,
        reps: SESSION_SETS.reps,
        weight: SESSION_SETS.weight,
        completed: SESSION_SETS.completed,
        exerciseName: EXERCISES.name,
        muscleGroup: EXERCISES.muscleGroup,
        equipment: EXERCISES.equipment,
      })
      .from(SESSION_SETS)
      .leftJoin(EXERCISES, eq(EXERCISES.id, SESSION_SETS.exerciseId))
      .where(
        and(familyFilter(SESSION_SETS, familyId), eq(SESSION_SETS.userId, viewingId), eq(SESSION_SETS.sessionId, todaySession.id))
      )
      .orderBy(asc(SESSION_SETS.exerciseId), asc(SESSION_SETS.setNumber));
  }

  const todayWater = {
    entries: todayWaterRows,
    totalMl: todayWaterRows.reduce((s, e) => s + (e.amountMl ?? 0), 0),
  };

  const exerciseMaxes = Object.fromEntries(
    (exerciseMaxRows ?? []).map((r) => [
      r.exerciseId,
      r.maxWeight == null ? null : Number(r.maxWeight),
    ])
  );

  // Server-computed streak using the viewee's FULL activity set, ignoring
  // any visibility flags below. This lets the streak number stay honest
  // even when individual sections are hidden from the viewer.
  const streakActiveDates = new Set();
  for (const r of allSessions) if (r.completed) streakActiveDates.add(r.date);
  for (const r of allSleep) streakActiveDates.add(r.date);
  for (const r of allMood) if (r.mood || r.energy) streakActiveDates.add(r.date);
  for (const r of allWaterAgg) streakActiveDates.add(r.date);
  for (const r of allCardio) streakActiveDates.add(r.date);
  for (const r of allBody) if (r.weightKg) streakActiveDates.add(r.date);
  for (const r of allMeals) streakActiveDates.add(r.date);
  for (const r of allMini) if (Number(r.count) > 0) streakActiveDates.add(r.date);
  const streak = computeStreak(streakActiveDates);

  const PRIVATE = { private: true };
  const vis = vieweeVisibility;
  const hidden = (flag) => isViewingOther && vis && !vis[flag];

  const todaySessionPayload = hidden("workouts")
    ? { ...PRIVATE, date, dayIndex, planDays: [], exercises: [], sets: [] }
    : {
        date,
        dayIndex,
        plan,
        planDay,
        planDays,
        exercises,
        session: todaySession,
        sets: todaySets,
      };

  return NextResponse.json({
    date,
    dayIndex,
    isViewingOther,
    viewingId,
    viewee,
    vieweeVisibility: isViewingOther ? vis : null,
    streak,
    todaySession: todaySessionPayload,
    today: {
      sleep: hidden("sleep") ? PRIVATE : todaySleep,
      water: todayWater,
      mood: hidden("mood") ? PRIVATE : todayMood,
      checkIn: isViewingOther ? null : todayCheckIn,
      cardio: hidden("cardio") ? [] : todayCardio,
      meals: hidden("meals") ? [] : todayMeals,
      mini: todayMini,
    },
    history: {
      sessions: hidden("workouts") ? [] : allSessions,
      sleep: hidden("sleep") ? [] : allSleep,
      mood: hidden("mood") ? [] : allMood,
      water: allWaterAgg,
      cardio: hidden("cardio") ? [] : allCardio,
      body: hidden("body") ? [] : allBody,
      meals: hidden("meals") ? [] : allMeals,
      mini: allMini,
    },
    userContext: isViewingOther ? null : userCtx,
    exerciseMaxes: hidden("workouts") ? {} : exerciseMaxes,
  });
});
