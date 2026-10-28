import { NextResponse } from "next/server";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { DAILY_CHECK_INS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

// Daily resistance / follow-through capture. One row per (user, date) - upsert.
export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const date = sp.get("date");

  if (date) {
    const [row] = await db
      .select()
      .from(DAILY_CHECK_INS)
      .where(and(familyFilter(DAILY_CHECK_INS, familyId), eq(DAILY_CHECK_INS.userId, userId), eq(DAILY_CHECK_INS.date, date)))
      .limit(1);
    return NextResponse.json(row ?? null);
  }

  const filters = [familyFilter(DAILY_CHECK_INS, familyId), eq(DAILY_CHECK_INS.userId, userId)];
  if (from) filters.push(gte(DAILY_CHECK_INS.date, from));
  if (to) filters.push(lte(DAILY_CHECK_INS.date, to));

  const rows = await db
    .select()
    .from(DAILY_CHECK_INS)
    .where(and(...filters))
    .orderBy(desc(DAILY_CHECK_INS.date));
  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const existing = await db
    .select()
    .from(DAILY_CHECK_INS)
    .where(and(familyFilter(DAILY_CHECK_INS, familyId), eq(DAILY_CHECK_INS.userId, userId), eq(DAILY_CHECK_INS.date, body.date)))
    .limit(1);

  const values = {
    resistance: body.resistance ?? null,
    followThroughScore: body.followThroughScore ?? null,
    intentionalRest: body.intentionalRest ?? false,
    note: clampString(body.note, "note"),
  };
  // closedAt: clients send `true` to stamp now, `false` to clear (unclose).
  // Anything else is silently ignored to keep the field optional on
  // legacy POSTs that don't know about it.
  if (body.closedAt === true) values.closedAt = new Date();
  else if (body.closedAt === false) values.closedAt = null;

  if (existing[0]) {
    const [row] = await db
      .update(DAILY_CHECK_INS)
      .set(values)
      .where(and(familyFilter(DAILY_CHECK_INS, familyId), eq(DAILY_CHECK_INS.id, existing[0].id), eq(DAILY_CHECK_INS.userId, userId)))
      .returning();
    return NextResponse.json(row);
  }
  const [row] = await db
    .insert(DAILY_CHECK_INS)
    .values({ userId, familyId, date: body.date, ...values })
    .returning();
  return NextResponse.json(row);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(DAILY_CHECK_INS)
    .where(and(familyFilter(DAILY_CHECK_INS, familyId), eq(DAILY_CHECK_INS.id, Number(id)), eq(DAILY_CHECK_INS.userId, userId)));
  return NextResponse.json({ success: true });
});
