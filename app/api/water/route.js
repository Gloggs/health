import { NextResponse } from "next/server";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { WATER_LOGS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&date=YYYY-MM-DD
// All scoped to the calling family member via userId AND (when flag on) familyId.
export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const date = sp.get("date");

  if (date) {
    const entries = await db
      .select()
      .from(WATER_LOGS)
      .where(and(familyFilter(WATER_LOGS, familyId), eq(WATER_LOGS.userId, userId), eq(WATER_LOGS.date, date)))
      .orderBy(desc(WATER_LOGS.createdAt));
    const totalMl = entries.reduce((s, e) => s + (e.amountMl ?? 0), 0);
    return NextResponse.json({ entries, totalMl });
  }

  const filters = [familyFilter(WATER_LOGS, familyId), eq(WATER_LOGS.userId, userId)];
  if (from) filters.push(gte(WATER_LOGS.date, from));
  if (to) filters.push(lte(WATER_LOGS.date, to));

  const rows = await db
    .select({
      date: WATER_LOGS.date,
      totalMl: sql`sum(${WATER_LOGS.amountMl})::int`.as("total_ml"),
    })
    .from(WATER_LOGS)
    .where(and(...filters))
    .groupBy(WATER_LOGS.date)
    .orderBy(desc(WATER_LOGS.date));

  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "date is required" }, { status: 400 });
  if (!body.amountMl || body.amountMl <= 0)
    return NextResponse.json({ error: "amountMl > 0 required" }, { status: 400 });

  const [row] = await db
    .insert(WATER_LOGS)
    .values({ userId, familyId, date: body.date, amountMl: body.amountMl })
    .returning();
  return NextResponse.json(row);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(WATER_LOGS)
    .where(and(familyFilter(WATER_LOGS, familyId), eq(WATER_LOGS.id, Number(id)), eq(WATER_LOGS.userId, userId)));
  return NextResponse.json({ success: true });
});
