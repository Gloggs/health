import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import {
  PLANS,
  PLAN_DAYS,
  PLAN_EXERCISES,
  EXERCISES,
  SESSIONS,
  SESSION_SETS,
} from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";

// Today changes every day and reads live DB state; never prerender
export const dynamic = "force-dynamic";

function todayDayIndex() {
  const js = new Date().getDay();
  return (js + 6) % 7;
}

function todayDateStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// GET /api/sessions/today
// Returns: { date, dayIndex, plan, planDay, exercises, session, sets }
// All scoped to the calling user (and family when flag is on).
export const GET = withFamily(async (_req, _ctx, { userId, familyId }) => {
  const date = todayDateStr();
  const dayIndex = todayDayIndex();

  const [plan] = await db
    .select()
    .from(PLANS)
    .where(and(familyFilter(PLANS, familyId), eq(PLANS.userId, userId), eq(PLANS.isActive, true)))
    .limit(1);

  let planDay = null;
  let exercises = [];
  if (plan) {
    const [pd] = await db
      .select()
      .from(PLAN_DAYS)
      .where(
        and(
          familyFilter(PLAN_DAYS, familyId),
          eq(PLAN_DAYS.userId, userId),
          eq(PLAN_DAYS.planId, plan.id),
          eq(PLAN_DAYS.dayIndex, dayIndex)
        )
      )
      .limit(1);
    planDay = pd ?? null;

    if (planDay) {
      // EXERCISES is the shared library - no user_id / family_id filter on the join.
      exercises = await db
        .select({
          id: PLAN_EXERCISES.id,
          exerciseId: PLAN_EXERCISES.exerciseId,
          position: PLAN_EXERCISES.position,
          targetSets: PLAN_EXERCISES.targetSets,
          targetReps: PLAN_EXERCISES.targetReps,
          targetWeight: PLAN_EXERCISES.targetWeight,
          notes: PLAN_EXERCISES.notes,
          name: EXERCISES.name,
          muscleGroup: EXERCISES.muscleGroup,
          equipment: EXERCISES.equipment,
        })
        .from(PLAN_EXERCISES)
        .leftJoin(EXERCISES, eq(EXERCISES.id, PLAN_EXERCISES.exerciseId))
        .where(
          and(
            familyFilter(PLAN_EXERCISES, familyId),
            eq(PLAN_EXERCISES.userId, userId),
            eq(PLAN_EXERCISES.planDayId, planDay.id)
          )
        )
        .orderBy(asc(PLAN_EXERCISES.position));
    }
  }

  const [session] = await db
    .select()
    .from(SESSIONS)
    .where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.userId, userId), eq(SESSIONS.date, date)))
    .limit(1);

  let sets = [];
  if (session) {
    sets = await db
      .select()
      .from(SESSION_SETS)
      .where(and(familyFilter(SESSION_SETS, familyId), eq(SESSION_SETS.userId, userId), eq(SESSION_SETS.sessionId, session.id)))
      .orderBy(asc(SESSION_SETS.exerciseId), asc(SESSION_SETS.setNumber));
  }

  return NextResponse.json({
    date,
    dayIndex,
    plan,
    planDay,
    exercises,
    session,
    sets,
  });
});
