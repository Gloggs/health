import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import {
  GOALS,
  SESSION_SETS,
  BODY_METRICS,
  EXERCISES,
  MEAL_LOGS,
} from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { exercisesVisibleTo } from "@/lib/exercises";
import { clampString } from "@/lib/validate";

// Monday of the current week as a YYYY-MM-DD local string (matches lib/dates).
function weekStartLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const idx = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - idx);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const dynamic = "force-dynamic";

// Annotate each goal with current progress so the UI can render a bar
// without a second round-trip. All lookups scoped to the caller.
async function annotateGoals(goals, userId, familyId) {
  if (goals.length === 0) return [];

  const liftExerciseIds = [
    ...new Set(
      goals
        .filter((g) => g.kind === "lift" && g.exerciseId != null)
        .map((g) => g.exerciseId)
    ),
  ];
  let liftMaxMap = new Map();
  let exerciseNameMap = new Map();
  if (liftExerciseIds.length > 0) {
    const rows = await db
      .select({
        exerciseId: SESSION_SETS.exerciseId,
        maxWeight: sql`MAX(${SESSION_SETS.weight}::numeric)`.as("max_weight"),
      })
      .from(SESSION_SETS)
      .where(and(familyFilter(SESSION_SETS, familyId), eq(SESSION_SETS.userId, userId), isNotNull(SESSION_SETS.weight)))
      .groupBy(SESSION_SETS.exerciseId);
    liftMaxMap = new Map(
      rows.map((r) => [r.exerciseId, r.maxWeight == null ? null : Number(r.maxWeight)])
    );
    const exRows = await db.select().from(EXERCISES).where(exercisesVisibleTo(familyId));
    exerciseNameMap = new Map(exRows.map((e) => [e.id, e.name]));
  }

  let latestWeight = null;
  if (goals.some((g) => g.kind === "weight")) {
    const [row] = await db
      .select()
      .from(BODY_METRICS)
      .where(and(familyFilter(BODY_METRICS, familyId), eq(BODY_METRICS.userId, userId), isNotNull(BODY_METRICS.weightKg)))
      .orderBy(desc(BODY_METRICS.date))
      .limit(1);
    latestWeight = row?.weightKg == null ? null : Number(row.weightKg);
  }

  let thisWeekJunk = null;
  if (goals.some((g) => g.kind === "junk-limit")) {
    const start = weekStartLocal();
    const today = todayLocal();
    const rows = await db
      .select()
      .from(MEAL_LOGS)
      .where(
        and(
          familyFilter(MEAL_LOGS, familyId),
          eq(MEAL_LOGS.userId, userId),
          gte(MEAL_LOGS.date, start),
          lte(MEAL_LOGS.date, today),
          eq(MEAL_LOGS.quality, 1)
        )
      );
    thisWeekJunk = rows.length;
  }

  return goals.map((g) => {
    let current = null;
    let exerciseName = null;
    if (g.kind === "lift" && g.exerciseId != null) {
      current = liftMaxMap.get(g.exerciseId) ?? null;
      exerciseName = exerciseNameMap.get(g.exerciseId) ?? null;
    } else if (g.kind === "weight") {
      current = latestWeight;
    } else if (g.kind === "junk-limit") {
      current = thisWeekJunk;
    }
    const target = g.targetValue == null ? null : Number(g.targetValue);
    let progress01 = null;
    if (current != null && target != null && target > 0) {
      if (g.kind === "weight") {
        progress01 = null;
      } else if (g.kind === "junk-limit") {
        progress01 = current / target;
      } else {
        progress01 = Math.min(1, current / target);
      }
    }
    return { ...g, current, exerciseName, progress01 };
  });
}

export const GET = withFamily(async (_req, _ctx, { userId, familyId }) => {
  const rows = await db
    .select()
    .from(GOALS)
    .where(and(familyFilter(GOALS, familyId), eq(GOALS.userId, userId)))
    .orderBy(desc(GOALS.createdAt));
  const annotated = await annotateGoals(rows, userId, familyId);
  return NextResponse.json(annotated);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.kind || !["lift", "weight", "junk-limit", "custom"].includes(body.kind)) {
    return NextResponse.json({ error: "kind must be lift|weight|junk-limit|custom" }, { status: 400 });
  }
  const description = clampString(body.description, "description", 120);
  if (!description) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  if (body.kind === "lift" && !body.exerciseId) {
    return NextResponse.json({ error: "lift goals need an exerciseId" }, { status: 400 });
  }
  const [row] = await db
    .insert(GOALS)
    .values({
      userId,
      familyId,
      kind: body.kind,
      exerciseId: body.kind === "lift" ? Number(body.exerciseId) : null,
      targetValue: body.targetValue == null ? null : String(body.targetValue),
      targetUnit: body.targetUnit ?? null,
      targetDate: body.targetDate ?? null,
      description,
      active: body.active ?? true,
    })
    .returning();
  return NextResponse.json(row);
});

export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const update = {};
  if ("kind" in body) update.kind = body.kind;
  if ("exerciseId" in body) update.exerciseId = body.exerciseId == null ? null : Number(body.exerciseId);
  if ("targetValue" in body) update.targetValue = body.targetValue == null ? null : String(body.targetValue);
  if ("targetUnit" in body) update.targetUnit = body.targetUnit ?? null;
  if ("targetDate" in body) update.targetDate = body.targetDate ?? null;
  if ("description" in body) update.description = clampString(body.description, "description", 120);
  if ("active" in body) update.active = !!body.active;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }
  const [row] = await db
    .update(GOALS)
    .set(update)
    .where(and(familyFilter(GOALS, familyId), eq(GOALS.id, body.id), eq(GOALS.userId, userId)))
    .returning();
  return NextResponse.json(row ?? null);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(GOALS)
    .where(and(familyFilter(GOALS, familyId), eq(GOALS.id, Number(id)), eq(GOALS.userId, userId)));
  return NextResponse.json({ success: true });
});
