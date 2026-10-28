import { NextResponse } from "next/server";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { CARDIO_LOGS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

// Cardio is append-only (multiple per day allowed: e.g. morning walk + evening run).
export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

  const filters = [familyFilter(CARDIO_LOGS, familyId), eq(CARDIO_LOGS.userId, userId)];
  if (from) filters.push(gte(CARDIO_LOGS.date, from));
  if (to) filters.push(lte(CARDIO_LOGS.date, to));

  const rows = await db
    .select()
    .from(CARDIO_LOGS)
    .where(and(...filters))
    .orderBy(desc(CARDIO_LOGS.date), desc(CARDIO_LOGS.createdAt));
  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const [row] = await db
    .insert(CARDIO_LOGS)
    .values({
      userId,
      familyId,
      date: body.date,
      type: body.type ?? "Walk",
      durationMinutes: body.durationMinutes ?? null,
      distanceKm: body.distanceKm ?? null,
      steps: body.steps ?? null,
      note: clampString(body.note, "note"),
    })
    .returning();
  return NextResponse.json(row);
});

export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const [row] = await db
    .update(CARDIO_LOGS)
    .set({
      type: body.type,
      durationMinutes: body.durationMinutes ?? null,
      distanceKm: body.distanceKm ?? null,
      steps: body.steps ?? null,
      note: clampString(body.note, "note"),
    })
    .where(and(familyFilter(CARDIO_LOGS, familyId), eq(CARDIO_LOGS.id, body.id), eq(CARDIO_LOGS.userId, userId)))
    .returning();
  return NextResponse.json(row ?? null);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(CARDIO_LOGS)
    .where(and(familyFilter(CARDIO_LOGS, familyId), eq(CARDIO_LOGS.id, Number(id)), eq(CARDIO_LOGS.userId, userId)));
  return NextResponse.json({ success: true });
});
