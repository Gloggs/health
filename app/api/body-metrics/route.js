import { NextResponse } from "next/server";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { BODY_METRICS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

  const filters = [familyFilter(BODY_METRICS, familyId), eq(BODY_METRICS.userId, userId)];
  if (from) filters.push(gte(BODY_METRICS.date, from));
  if (to) filters.push(lte(BODY_METRICS.date, to));

  const rows = await db
    .select()
    .from(BODY_METRICS)
    .where(and(...filters))
    .orderBy(desc(BODY_METRICS.date));
  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const existing = await db
    .select()
    .from(BODY_METRICS)
    .where(and(familyFilter(BODY_METRICS, familyId), eq(BODY_METRICS.userId, userId), eq(BODY_METRICS.date, body.date)))
    .limit(1);

  const values = {
    weightKg: body.weightKg ?? null,
    waistCm: body.waistCm ?? null,
    chestCm: body.chestCm ?? null,
    armsCm: body.armsCm ?? null,
    hipsCm: body.hipsCm ?? null,
    thighsCm: body.thighsCm ?? null,
    note: clampString(body.note, "note"),
  };
  if (existing[0]) {
    const [row] = await db
      .update(BODY_METRICS)
      .set(values)
      .where(and(familyFilter(BODY_METRICS, familyId), eq(BODY_METRICS.id, existing[0].id), eq(BODY_METRICS.userId, userId)))
      .returning();
    return NextResponse.json(row);
  }
  const [row] = await db
    .insert(BODY_METRICS)
    .values({ userId, familyId, date: body.date, ...values })
    .returning();
  return NextResponse.json(row);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(BODY_METRICS)
    .where(and(familyFilter(BODY_METRICS, familyId), eq(BODY_METRICS.id, Number(id)), eq(BODY_METRICS.userId, userId)));
  return NextResponse.json({ success: true });
});
