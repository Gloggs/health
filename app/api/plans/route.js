import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { PLANS, PLAN_DAYS, PLAN_EXERCISES, SESSIONS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const GET = withFamily(async (_req, _ctx, { userId, familyId }) => {
  const plans = await db
    .select()
    .from(PLANS)
    .where(and(familyFilter(PLANS, familyId), eq(PLANS.userId, userId)))
    .orderBy(PLANS.id);

  const planIds = plans.map((p) => p.id);
  if (planIds.length === 0) return NextResponse.json([]);

  // Annotate each plan with exercise/day counts. Scoped to the user via
  // PLAN_DAYS.userId so cross-tenant rows never leak into the count.
  const counts = await db
    .select({
      planId: PLAN_DAYS.planId,
      total: sql`COUNT(${PLAN_EXERCISES.id})`.as("total"),
    })
    .from(PLAN_DAYS)
    .leftJoin(PLAN_EXERCISES, eq(PLAN_EXERCISES.planDayId, PLAN_DAYS.id))
    .where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.userId, userId)))
    .groupBy(PLAN_DAYS.planId);

  const countMap = new Map(counts.map((c) => [c.planId, Number(c.total) || 0]));

  const dayCounts = await db
    .select({
      planId: PLAN_DAYS.planId,
      training: sql`SUM(CASE WHEN ${PLAN_DAYS.label} <> 'Rest' THEN 1 ELSE 0 END)::int`.as("training"),
    })
    .from(PLAN_DAYS)
    .where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.userId, userId)))
    .groupBy(PLAN_DAYS.planId);

  const trainingMap = new Map(dayCounts.map((c) => [c.planId, Number(c.training) || 0]));

  const allDays = await db
    .select({ planId: PLAN_DAYS.planId, dayIndex: PLAN_DAYS.dayIndex, label: PLAN_DAYS.label })
    .from(PLAN_DAYS)
    .where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.userId, userId)))
    .orderBy(asc(PLAN_DAYS.planId), asc(PLAN_DAYS.dayIndex));
  const daysByPlan = new Map();
  for (const d of allDays) {
    if (!daysByPlan.has(d.planId)) daysByPlan.set(d.planId, []);
    daysByPlan.get(d.planId).push({ dayIndex: d.dayIndex, label: d.label });
  }

  return NextResponse.json(
    plans.map((p) => {
      const trainingDays = trainingMap.get(p.id) ?? 0;
      return {
        ...p,
        exerciseCount: countMap.get(p.id) ?? 0,
        trainingDays,
        restDays: Math.max(0, 7 - trainingDays),
        days: daysByPlan.get(p.id) ?? [],
      };
    })
  );
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  const name = clampString(body.name, "name");
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [plan] = await db
    .insert(PLANS)
    .values({
      userId,
      familyId,
      name,
      description: clampString(body.description, "description"),
      isActive: false,
      repeatWeekly: body.repeatWeekly ?? true,
    })
    .returning();

  // Seed all 7 day slots as Rest by default - stamped with the owner +
  // family so future queries can filter without joining through PLANS.
  await db.insert(PLAN_DAYS).values(
    DAY_LABELS.map((_label, i) => ({
      userId,
      familyId,
      planId: plan.id,
      dayIndex: i,
      label: "Rest",
    }))
  );

  return NextResponse.json(plan);
});

// Partial update so a rename doesn't accidentally clear other fields.
export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const update = {};
  if ("name" in body) {
    const name = clampString(body.name, "name");
    if (!name) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    update.name = name;
  }
  if ("description" in body) update.description = clampString(body.description, "description");
  if ("repeatWeekly" in body) update.repeatWeekly = !!body.repeatWeekly;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }
  const [row] = await db
    .update(PLANS)
    .set(update)
    .where(and(familyFilter(PLANS, familyId), eq(PLANS.id, body.id), eq(PLANS.userId, userId)))
    .returning();
  return NextResponse.json(row ?? null);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const planId = Number(id);
  // Ownership check first so we never touch a sibling family member's data
  // even by mistake.
  const [owned] = await db
    .select({ id: PLANS.id })
    .from(PLANS)
    .where(and(familyFilter(PLANS, familyId), eq(PLANS.id, planId), eq(PLANS.userId, userId)))
    .limit(1);
  if (!owned) {
    return NextResponse.json({ error: "plan not found" }, { status: 404 });
  }

  const days = await db
    .select({ id: PLAN_DAYS.id })
    .from(PLAN_DAYS)
    .where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.planId, planId), eq(PLAN_DAYS.userId, userId)));
  for (const d of days) {
    await db
      .update(SESSIONS)
      .set({ planDayId: null })
      .where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.planDayId, d.id), eq(SESSIONS.userId, userId)));
    await db
      .delete(PLAN_EXERCISES)
      .where(and(familyFilter(PLAN_EXERCISES, familyId), eq(PLAN_EXERCISES.planDayId, d.id), eq(PLAN_EXERCISES.userId, userId)));
  }
  await db
    .delete(PLAN_DAYS)
    .where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.planId, planId), eq(PLAN_DAYS.userId, userId)));
  await db.delete(PLANS).where(and(familyFilter(PLANS, familyId), eq(PLANS.id, planId), eq(PLANS.userId, userId)));
  return NextResponse.json({ success: true });
});
