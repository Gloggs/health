import { NextResponse } from "next/server";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { MOOD_LOGS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { normaliseTags } from "@/lib/usuals";
import { clampString } from "@/lib/validate";

export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const date = sp.get("date");

  if (date) {
    const [row] = await db
      .select()
      .from(MOOD_LOGS)
      .where(and(familyFilter(MOOD_LOGS, familyId), eq(MOOD_LOGS.userId, userId), eq(MOOD_LOGS.date, date)))
      .limit(1);
    return NextResponse.json(row ?? null);
  }

  const filters = [familyFilter(MOOD_LOGS, familyId), eq(MOOD_LOGS.userId, userId)];
  if (from) filters.push(gte(MOOD_LOGS.date, from));
  if (to) filters.push(lte(MOOD_LOGS.date, to));

  const rows = await db
    .select()
    .from(MOOD_LOGS)
    .where(and(...filters))
    .orderBy(desc(MOOD_LOGS.date));
  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const existing = await db
    .select()
    .from(MOOD_LOGS)
    .where(and(familyFilter(MOOD_LOGS, familyId), eq(MOOD_LOGS.userId, userId), eq(MOOD_LOGS.date, body.date)))
    .limit(1);

  const values = {
    mood: body.mood ?? null,
    energy: body.energy ?? null,
    note: clampString(body.note, "note"),
  };
  // Only touch tags when they are sent, so older clients keep existing ones.
  if ("tags" in body) values.tags = normaliseTags(body.tags);
  if (existing[0]) {
    const [row] = await db
      .update(MOOD_LOGS)
      .set(values)
      .where(and(familyFilter(MOOD_LOGS, familyId), eq(MOOD_LOGS.id, existing[0].id), eq(MOOD_LOGS.userId, userId)))
      .returning();
    return NextResponse.json(row);
  }
  const [row] = await db
    .insert(MOOD_LOGS)
    .values({ userId, familyId, date: body.date, ...values })
    .returning();
  return NextResponse.json(row);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(MOOD_LOGS)
    .where(and(familyFilter(MOOD_LOGS, familyId), eq(MOOD_LOGS.id, Number(id)), eq(MOOD_LOGS.userId, userId)));
  return NextResponse.json({ success: true });
});
