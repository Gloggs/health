import { NextResponse } from "next/server";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { SESSIONS, SESSION_SETS, PLAN_DAYS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
// Joins PLAN_DAYS so callers can tell rest-day sessions from real workout
// sessions (rest days are excluded from the workout count on Today, Train
// and Trends).
export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const filters = [familyFilter(SESSIONS, familyId), eq(SESSIONS.userId, userId)];
  if (from) filters.push(gte(SESSIONS.date, from));
  if (to) filters.push(lte(SESSIONS.date, to));

  const rows = await db
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
    .where(and(...filters))
    .orderBy(desc(SESSIONS.date));
  return NextResponse.json(rows);
});

// POST: complete or create a session for { date, planDayId?, notes?, durationMinutes?, completed }
// If a session already exists for that (user, date), it's updated rather than duplicated.
export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(SESSIONS)
    .where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.userId, userId), eq(SESSIONS.date, body.date)))
    .limit(1);

  // Preserve existing notes if body doesn't include the field; cap length
  // and trim if it does. Same pattern for any other free-text fields.
  const newNotes =
    "notes" in body ? clampString(body.notes, "notes") : existing[0]?.notes ?? null;

  if (existing[0]) {
    const [row] = await db
      .update(SESSIONS)
      .set({
        planDayId: body.planDayId ?? existing[0].planDayId,
        notes: newNotes,
        durationMinutes: body.durationMinutes ?? existing[0].durationMinutes,
        completed: body.completed ?? true,
      })
      .where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.id, existing[0].id), eq(SESSIONS.userId, userId)))
      .returning();
    return NextResponse.json(row);
  }

  const [row] = await db
    .insert(SESSIONS)
    .values({
      userId,
      familyId,
      date: body.date,
      planDayId: body.planDayId ?? null,
      notes: newNotes,
      durationMinutes: body.durationMinutes ?? null,
      completed: body.completed ?? true,
    })
    .returning();
  return NextResponse.json(row);
});

export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  // Partial update - only touch fields the caller sent.
  const update = {};
  if ("notes" in body) update.notes = clampString(body.notes, "notes");
  if ("durationMinutes" in body) update.durationMinutes = body.durationMinutes ?? null;
  if ("completed" in body) update.completed = !!body.completed;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const [row] = await db
    .update(SESSIONS)
    .set(update)
    .where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.id, body.id), eq(SESSIONS.userId, userId)))
    .returning();
  return NextResponse.json(row ?? null);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  // Cascade: delete the session's sets first, both filtered by user_id so
  // we can't accidentally delete a different user's sets if ids collide.
  await db
    .delete(SESSION_SETS)
    .where(and(familyFilter(SESSION_SETS, familyId), eq(SESSION_SETS.sessionId, Number(id)), eq(SESSION_SETS.userId, userId)));
  await db
    .delete(SESSIONS)
    .where(and(familyFilter(SESSIONS, familyId), eq(SESSIONS.id, Number(id)), eq(SESSIONS.userId, userId)));
  return NextResponse.json({ success: true });
});
