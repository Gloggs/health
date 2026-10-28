import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { SESSION_SETS, SESSIONS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { canUseExercise } from "@/lib/exercises";

// POST: { sessionId, exerciseId, setNumber, reps?, weight?, completed? }
// Verifies the parent session belongs to the caller before inserting a set.
export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.sessionId || !body.exerciseId || body.setNumber === undefined) {
    return NextResponse.json(
      { error: "sessionId, exerciseId, setNumber are required" },
      { status: 400 }
    );
  }

  // Reject attempts to add sets to another user's session.
  const [parent] = await db
    .select({ id: SESSIONS.id })
    .from(SESSIONS)
    .where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.id, body.sessionId), eq(SESSIONS.userId, userId)))
    .limit(1);
  if (!parent) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (!(await canUseExercise(body.exerciseId, familyId))) {
    return NextResponse.json({ error: "exercise not found" }, { status: 404 });
  }

  const [row] = await db
    .insert(SESSION_SETS)
    .values({
      userId,
      familyId,
      sessionId: body.sessionId,
      exerciseId: body.exerciseId,
      setNumber: body.setNumber,
      reps: body.reps ?? null,
      weight: body.weight !== undefined && body.weight !== null ? String(body.weight) : null,
      completed: body.completed ?? true,
    })
    .returning();
  return NextResponse.json(row);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(SESSION_SETS)
    .where(and(familyFilter(SESSION_SETS, familyId), eq(SESSION_SETS.id, Number(id)), eq(SESSION_SETS.userId, userId)));
  return NextResponse.json({ success: true });
});
