import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { PLAN_EXERCISES, PLAN_DAYS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";
import { canUseExercise } from "@/lib/exercises";

// POST: add an exercise to a plan day. Verifies ownership of the parent
// day before inserting so a tampered planDayId can't drop a row into
// another user's plan.
export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.planDayId || !body.exerciseId) {
    return NextResponse.json({ error: "planDayId and exerciseId required" }, { status: 400 });
  }

  const [parentDay] = await db
    .select({ id: PLAN_DAYS.id })
    .from(PLAN_DAYS)
    .where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.id, body.planDayId), eq(PLAN_DAYS.userId, userId)))
    .limit(1);
  if (!parentDay) return NextResponse.json({ error: "plan day not found" }, { status: 404 });
  if (!(await canUseExercise(body.exerciseId, familyId))) {
    return NextResponse.json({ error: "exercise not found" }, { status: 404 });
  }

  // Default position to end of list within this day for this user.
  const [{ max }] = await db
    .select({ max: sql`COALESCE(MAX(${PLAN_EXERCISES.position}), -1)`.as("max") })
    .from(PLAN_EXERCISES)
    .where(
      and(familyFilter(PLAN_EXERCISES, familyId), eq(PLAN_EXERCISES.userId, userId), eq(PLAN_EXERCISES.planDayId, body.planDayId))
    );

  const [row] = await db
    .insert(PLAN_EXERCISES)
    .values({
      userId,
      familyId,
      planDayId: body.planDayId,
      exerciseId: body.exerciseId,
      position: (Number(max) ?? -1) + 1,
      targetSets: body.targetSets ?? null,
      targetReps: body.targetReps ?? null,
      targetWeight: body.targetWeight ?? null,
      targetDurationMinutes: body.targetDurationMinutes ?? null,
      targetDistanceKm: body.targetDistanceKm ?? null,
      notes: clampString(body.notes, "notes"),
    })
    .returning();
  return NextResponse.json(row);
});

export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  // Partial update - only touch fields the caller actually sent.
  const update = {};
  if ("targetSets" in body) update.targetSets = body.targetSets ?? null;
  if ("targetReps" in body) update.targetReps = body.targetReps ?? null;
  if ("targetWeight" in body) update.targetWeight = body.targetWeight ?? null;
  if ("targetDurationMinutes" in body) update.targetDurationMinutes = body.targetDurationMinutes ?? null;
  if ("targetDistanceKm" in body) update.targetDistanceKm = body.targetDistanceKm ?? null;
  if ("notes" in body) update.notes = clampString(body.notes, "notes");
  if ("position" in body) update.position = body.position;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const [row] = await db
    .update(PLAN_EXERCISES)
    .set(update)
    .where(and(familyFilter(PLAN_EXERCISES, familyId), eq(PLAN_EXERCISES.id, body.id), eq(PLAN_EXERCISES.userId, userId)))
    .returning();
  return NextResponse.json(row ?? null);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(PLAN_EXERCISES)
    .where(and(familyFilter(PLAN_EXERCISES, familyId), eq(PLAN_EXERCISES.id, Number(id)), eq(PLAN_EXERCISES.userId, userId)));
  return NextResponse.json({ success: true });
});
