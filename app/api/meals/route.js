import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { MEAL_LOGS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

// GET /api/meals
//   ?date=YYYY-MM-DD  → all meals for that date
//   ?from=...&to=...  → range
//   (no params)       → everything, newest first
// Always scoped to the caller's family + user.
export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date");
  const from = sp.get("from");
  const to = sp.get("to");

  if (date) {
    const rows = await db
      .select()
      .from(MEAL_LOGS)
      .where(and(familyFilter(MEAL_LOGS, familyId), eq(MEAL_LOGS.userId, userId), eq(MEAL_LOGS.date, date)))
      .orderBy(asc(MEAL_LOGS.createdAt));
    return NextResponse.json(rows);
  }

  const filters = [familyFilter(MEAL_LOGS, familyId), eq(MEAL_LOGS.userId, userId)];
  if (from) filters.push(gte(MEAL_LOGS.date, from));
  if (to) filters.push(lte(MEAL_LOGS.date, to));

  const rows = await db
    .select()
    .from(MEAL_LOGS)
    .where(and(...filters))
    .orderBy(desc(MEAL_LOGS.date), desc(MEAL_LOGS.createdAt));
  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "date is required" }, { status: 400 });
  if (!body.slot || !SLOTS.includes(body.slot)) {
    return NextResponse.json({ error: "slot must be breakfast|lunch|dinner|snack" }, { status: 400 });
  }
  const quality = body.quality == null ? null : Math.min(3, Math.max(1, Number(body.quality)));
  const [row] = await db
    .insert(MEAL_LOGS)
    .values({
      userId,
      familyId,
      date: body.date,
      slot: body.slot,
      description: clampString(body.description, "description"),
      quality,
    })
    .returning();
  return NextResponse.json(row);
});

export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const update = {};
  if ("slot" in body) {
    if (!SLOTS.includes(body.slot)) {
      return NextResponse.json({ error: "invalid slot" }, { status: 400 });
    }
    update.slot = body.slot;
  }
  if ("description" in body) update.description = clampString(body.description, "description");
  if ("quality" in body) {
    update.quality = body.quality == null ? null : Math.min(3, Math.max(1, Number(body.quality)));
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }
  const [row] = await db
    .update(MEAL_LOGS)
    .set(update)
    .where(and(familyFilter(MEAL_LOGS, familyId), eq(MEAL_LOGS.id, body.id), eq(MEAL_LOGS.userId, userId)))
    .returning();
  return NextResponse.json(row ?? null);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(MEAL_LOGS)
    .where(and(familyFilter(MEAL_LOGS, familyId), eq(MEAL_LOGS.id, Number(id)), eq(MEAL_LOGS.userId, userId)));
  return NextResponse.json({ success: true });
});
