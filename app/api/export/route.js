import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import {
  EXERCISES,
  PLANS,
  PLAN_DAYS,
  PLAN_EXERCISES,
  SESSIONS,
  SESSION_SETS,
  SLEEP_LOGS,
  WATER_LOGS,
  MOOD_LOGS,
  BODY_METRICS,
  CARDIO_LOGS,
  MEAL_LOGS,
  DAILY_MINI_LOGS,
  CHAT_MESSAGES,
  DAILY_CHECK_INS,
  USER_CONTEXT,
  REMINDERS,
  GOALS,
  USERS,
} from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";
import { exercisesVisibleTo } from "@/lib/exercises";

export const dynamic = "force-dynamic";

// One-click full export. Returns JSON of every table the calling user owns.
// EXERCISES is intentionally included unfiltered - it's the shared library
// and the user references its ids in their plan_exercises.
//
// Schema version 2 adds: meals, daily mini-workouts, goals, and the user
// profile row from the family-tenant migration. Earlier exports (v1) won't
// have these keys; importers should default to [] when missing.
export const GET = withFamily(async (_req, _ctx, { userId, familyId, email }) => {
  const [
    exercises,
    plans,
    planDays,
    planExercises,
    sessions,
    sessionSets,
    sleep,
    water,
    mood,
    body,
    cardio,
    meals,
    mini,
    chat,
    checkIns,
    context,
    reminders,
    goals,
    me,
  ] = await Promise.all([
    db.select().from(EXERCISES).where(exercisesVisibleTo(familyId)).orderBy(desc(EXERCISES.createdAt)),
    db.select().from(PLANS).where(and(familyFilter(PLANS, familyId), eq(PLANS.userId, userId))).orderBy(desc(PLANS.createdAt)),
    db.select().from(PLAN_DAYS).where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.userId, userId))),
    db.select().from(PLAN_EXERCISES).where(and(familyFilter(PLAN_EXERCISES, familyId), eq(PLAN_EXERCISES.userId, userId))),
    db.select().from(SESSIONS).where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.userId, userId))).orderBy(desc(SESSIONS.date)),
    db.select().from(SESSION_SETS).where(and(familyFilter(SESSION_SETS, familyId), eq(SESSION_SETS.userId, userId))),
    db.select().from(SLEEP_LOGS).where(and(familyFilter(SLEEP_LOGS, familyId), eq(SLEEP_LOGS.userId, userId))).orderBy(desc(SLEEP_LOGS.date)),
    db.select().from(WATER_LOGS).where(and(familyFilter(WATER_LOGS, familyId), eq(WATER_LOGS.userId, userId))).orderBy(desc(WATER_LOGS.date)),
    db.select().from(MOOD_LOGS).where(and(familyFilter(MOOD_LOGS, familyId), eq(MOOD_LOGS.userId, userId))).orderBy(desc(MOOD_LOGS.date)),
    db.select().from(BODY_METRICS).where(and(familyFilter(BODY_METRICS, familyId), eq(BODY_METRICS.userId, userId))).orderBy(desc(BODY_METRICS.date)),
    db.select().from(CARDIO_LOGS).where(and(familyFilter(CARDIO_LOGS, familyId), eq(CARDIO_LOGS.userId, userId))).orderBy(desc(CARDIO_LOGS.date)),
    db.select().from(MEAL_LOGS).where(and(familyFilter(MEAL_LOGS, familyId), eq(MEAL_LOGS.userId, userId))).orderBy(desc(MEAL_LOGS.date)),
    db.select().from(DAILY_MINI_LOGS).where(and(familyFilter(DAILY_MINI_LOGS, familyId), eq(DAILY_MINI_LOGS.userId, userId))).orderBy(desc(DAILY_MINI_LOGS.date)),
    db.select().from(CHAT_MESSAGES).where(and(familyFilter(CHAT_MESSAGES, familyId), eq(CHAT_MESSAGES.userId, userId))).orderBy(desc(CHAT_MESSAGES.createdAt)),
    db.select().from(DAILY_CHECK_INS).where(and(familyFilter(DAILY_CHECK_INS, familyId), eq(DAILY_CHECK_INS.userId, userId))).orderBy(desc(DAILY_CHECK_INS.date)),
    db.select().from(USER_CONTEXT).where(and(familyFilter(USER_CONTEXT, familyId), eq(USER_CONTEXT.userId, userId))),
    db.select().from(REMINDERS).where(and(familyFilter(REMINDERS, familyId), eq(REMINDERS.userId, userId))),
    db.select().from(GOALS).where(and(familyFilter(GOALS, familyId), eq(GOALS.userId, userId))),
    db.select().from(USERS).where(eq(USERS.id, userId)).limit(1),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    schemaVersion: 2,
    profile: { user: me[0] ?? { id: userId, email }, goals },
    workouts: { exercises, plans, planDays, planExercises, sessions, sessionSets },
    health: { sleep, water, mood, body, cardio, meals, mini },
    journal: { chat, checkIns },
    coach: { context },
    reminders,
  });
});
