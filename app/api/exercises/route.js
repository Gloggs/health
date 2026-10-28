import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { EXERCISES, PLAN_EXERCISES, SESSION_SETS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { exercisesVisibleTo } from "@/lib/exercises";

// The library has two kinds of row:
//   - starter exercises (family_id NULL): shared by every family, read-only
//   - custom exercises (family_id set): added by one family, only they can
//     see, rename or delete them
// Before this split the whole table was shared, so any signed-in user could
// rename or delete an exercise for everyone, and deleting it also removed
// other families' logged sets.
const STARTER_LIBRARY = [
  // Chest
  { name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { name: "Incline Dumbbell Press", muscleGroup: "Chest", equipment: "Dumbbell" },
  { name: "Press-ups", muscleGroup: "Chest", equipment: "Bodyweight" },
  { name: "Chest Fly", muscleGroup: "Chest", equipment: "Cable" },

  // Back
  { name: "Deadlift", muscleGroup: "Back", equipment: "Barbell" },
  { name: "Pull-ups", muscleGroup: "Back", equipment: "Bodyweight" },
  { name: "Barbell Row", muscleGroup: "Back", equipment: "Barbell" },
  { name: "Lat Pulldown", muscleGroup: "Back", equipment: "Cable" },
  { name: "Seated Row", muscleGroup: "Back", equipment: "Cable" },

  // Legs
  { name: "Back Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Front Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Romanian Deadlift", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Leg Press", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Walking Lunges", muscleGroup: "Legs", equipment: "Dumbbell" },
  { name: "Leg Curl", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Calf Raise", muscleGroup: "Legs", equipment: "Machine" },

  // Shoulders
  { name: "Overhead Press", muscleGroup: "Shoulders", equipment: "Barbell" },
  { name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  { name: "Lateral Raise", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  { name: "Face Pull", muscleGroup: "Shoulders", equipment: "Cable" },

  // Arms
  { name: "Barbell Curl", muscleGroup: "Arms", equipment: "Barbell" },
  { name: "Dumbbell Curl", muscleGroup: "Arms", equipment: "Dumbbell" },
  { name: "Hammer Curl", muscleGroup: "Arms", equipment: "Dumbbell" },
  { name: "Triceps Pushdown", muscleGroup: "Arms", equipment: "Cable" },
  { name: "Overhead Triceps Extension", muscleGroup: "Arms", equipment: "Dumbbell" },
  { name: "Dips", muscleGroup: "Arms", equipment: "Bodyweight" },

  // Core
  { name: "Plank", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Hanging Knee Raise", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Cable Crunch", muscleGroup: "Core", equipment: "Cable" },

  // Cardio / conditioning
  { name: "Treadmill Run", muscleGroup: "Cardio", equipment: "Machine" },
  { name: "Rowing Machine", muscleGroup: "Cardio", equipment: "Machine" },
  { name: "Stationary Bike", muscleGroup: "Cardio", equipment: "Machine" },
];

async function ensureSeeded() {
  const [starter] = await db.select({ id: EXERCISES.id }).from(EXERCISES).where(isNull(EXERCISES.familyId)).limit(1);
  if (!starter) await db.insert(EXERCISES).values(STARTER_LIBRARY);
}

export const GET = withFamily(async (_req, _ctx, { familyId }) => {
  await ensureSeeded();
  const rows = await db.select().from(EXERCISES).where(exercisesVisibleTo(familyId));
  rows.sort((a, b) =>
    a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name)
  );
  return NextResponse.json(rows.map((r) => ({ ...r, isStarter: r.familyId == null })));
});

export const POST = withFamilyWrite(async (req, _ctx, { familyId }) => {
  const body = await req.json();
  const name = String(body.name ?? "").trim().slice(0, 80);
  const muscleGroup = String(body.muscleGroup ?? "").trim().slice(0, 30);
  if (!name || !muscleGroup) {
    return NextResponse.json({ error: "name and muscleGroup are required" }, { status: 400 });
  }
  const [row] = await db
    .insert(EXERCISES)
    .values({
      familyId,
      name,
      muscleGroup,
      equipment: String(body.equipment ?? "Bodyweight").slice(0, 30),
      notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    })
    .returning();
  return NextResponse.json({ ...row, isStarter: false });
});

// Only the family's own exercises can change. A starter exercise or another
// family's id matches no row and comes back as 404.
export const PUT = withFamilyWrite(async (req, _ctx, { familyId }) => {
  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const patch = {};
  if (body.name != null) patch.name = String(body.name).trim().slice(0, 80);
  if (body.muscleGroup != null) patch.muscleGroup = String(body.muscleGroup).trim().slice(0, 30);
  if (body.equipment != null) patch.equipment = String(body.equipment).slice(0, 30);
  if ("notes" in body) patch.notes = body.notes ? String(body.notes).slice(0, 2000) : null;
  if (patch.name === "" || patch.muscleGroup === "") {
    return NextResponse.json({ error: "name and muscleGroup cannot be empty" }, { status: 400 });
  }
  const [row] = await db
    .update(EXERCISES)
    .set(patch)
    .where(and(eq(EXERCISES.id, id), eq(EXERCISES.familyId, familyId)))
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Starter exercises cannot be changed." }, { status: 404 });
  }
  return NextResponse.json({ ...row, isStarter: false });
});

// Deleting a custom exercise removes it from this family's plans and sets
// only. Nothing outside the family is touched.
export const DELETE = withFamilyWrite(async (req, _ctx, { familyId }) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const [own] = await db
    .select({ id: EXERCISES.id })
    .from(EXERCISES)
    .where(and(eq(EXERCISES.id, id), eq(EXERCISES.familyId, familyId)))
    .limit(1);
  if (!own) {
    return NextResponse.json({ error: "Starter exercises cannot be deleted." }, { status: 404 });
  }
  await db.delete(PLAN_EXERCISES).where(and(familyFilter(PLAN_EXERCISES, familyId), eq(PLAN_EXERCISES.exerciseId, id)));
  await db.delete(SESSION_SETS).where(and(familyFilter(SESSION_SETS, familyId), eq(SESSION_SETS.exerciseId, id)));
  await db.delete(EXERCISES).where(and(eq(EXERCISES.id, id), eq(EXERCISES.familyId, familyId)));
  return NextResponse.json({ success: true });
});
