import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { PLANS, PLAN_DAYS, PLAN_EXERCISES, EXERCISES } from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/plans/[id] - returns the plan with nested days[exercises].
// 404s on plans owned by another family member.
export const GET = withFamily(async (_req, { params }, { userId, familyId }) => {
  const planId = Number(params.id);
  if (!planId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const [plan] = await db
    .select()
    .from(PLANS)
    .where(and(familyFilter(PLANS, familyId), eq(PLANS.id, planId), eq(PLANS.userId, userId)))
    .limit(1);
  if (!plan) return NextResponse.json({ error: "not found" }, { status: 404 });

  const days = await db
    .select()
    .from(PLAN_DAYS)
    .where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.planId, planId), eq(PLAN_DAYS.userId, userId)))
    .orderBy(asc(PLAN_DAYS.dayIndex));

  const dayIds = days.map((d) => d.id);

  const planExercises =
    dayIds.length === 0
      ? []
      : await db
          .select({
            id: PLAN_EXERCISES.id,
            planDayId: PLAN_EXERCISES.planDayId,
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
          .where(and(familyFilter(PLAN_EXERCISES, familyId), eq(PLAN_EXERCISES.userId, userId)))
          .orderBy(asc(PLAN_EXERCISES.position));

  const exByDay = new Map();
  for (const pe of planExercises) {
    if (!exByDay.has(pe.planDayId)) exByDay.set(pe.planDayId, []);
    exByDay.get(pe.planDayId).push(pe);
  }

  return NextResponse.json({
    ...plan,
    days: days.map((d) => ({ ...d, exercises: exByDay.get(d.id) ?? [] })),
  });
});
