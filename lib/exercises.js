import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { EXERCISES } from "@/utils/schema";

// True when the exercise is a starter or belongs to this family. Used before
// writing an exercise id into a plan or a set, so a family cannot attach (and
// then read the name of) another family's custom exercise.
export async function canUseExercise(exerciseId, familyId) {
  const id = Number(exerciseId);
  if (!Number.isInteger(id)) return false;
  const [row] = await db
    .select({ id: EXERCISES.id })
    .from(EXERCISES)
    .where(
      and(
        eq(EXERCISES.id, id),
        or(isNull(EXERCISES.familyId), eq(EXERCISES.familyId, familyId))
      )
    )
    .limit(1);
  return !!row;
}

// Drizzle condition for the exercises a family may see: the starters plus
// their own.
export function exercisesVisibleTo(familyId) {
  return or(isNull(EXERCISES.familyId), eq(EXERCISES.familyId, familyId));
}
