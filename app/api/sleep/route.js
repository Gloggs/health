import { NextResponse } from "next/server";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { SLEEP_LOGS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&date=YYYY-MM-DD
// All queries scoped to the caller via userId AND (when the workspace flag
// is on) familyId. familyFilter() returns undefined when the flag is off
// so and() drops it - behavior matches the single-tenant rollout.
export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const date = sp.get("date");

  if (date) {
    const [row] = await db
      .select()
      .from(SLEEP_LOGS)
      .where(and(familyFilter(SLEEP_LOGS, familyId), eq(SLEEP_LOGS.userId, userId), eq(SLEEP_LOGS.date, date)))
      .limit(1);
    return NextResponse.json(row ?? null);
  }

  const filters = [familyFilter(SLEEP_LOGS, familyId), eq(SLEEP_LOGS.userId, userId)];
  if (from) filters.push(gte(SLEEP_LOGS.date, from));
  if (to) filters.push(lte(SLEEP_LOGS.date, to));

  const rows = await db
    .select()
    .from(SLEEP_LOGS)
    .where(and(...filters))
    .orderBy(desc(SLEEP_LOGS.date));
  return NextResponse.json(rows);
});

// Upsert one row per (user, date). The existence check is scoped to userId
// so the upsert never touches another family member's row even if dates collide.
export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const existing = await db
    .select()
    .from(SLEEP_LOGS)
    .where(and(familyFilter(SLEEP_LOGS, familyId), eq(SLEEP_LOGS.userId, userId), eq(SLEEP_LOGS.date, body.date)))
    .limit(1);

  const values = {
    bedtime: body.bedtime ?? null,
    wakeTime: body.wakeTime ?? null,
    hours: body.hours ?? null,
    quality: body.quality ?? null,
    note: clampString(body.note, "note"),
  };

  if (existing[0]) {
    const [row] = await db
      .update(SLEEP_LOGS)
      .set(values)
      .where(and(familyFilter(SLEEP_LOGS, familyId), eq(SLEEP_LOGS.id, existing[0].id), eq(SLEEP_LOGS.userId, userId)))
      .returning();
    return NextResponse.json(row);
  }
  const [row] = await db
    .insert(SLEEP_LOGS)
    .values({ userId, familyId, date: body.date, ...values })
    .returning();
  return NextResponse.json(row);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  // userId in the WHERE clause is what stops a user from deleting another
  // family member's row by guessing its id. familyFilter adds family scope
  // when the flag is on - belt-and-braces.
  await db
    .delete(SLEEP_LOGS)
    .where(and(familyFilter(SLEEP_LOGS, familyId), eq(SLEEP_LOGS.id, Number(id)), eq(SLEEP_LOGS.userId, userId)));
  return NextResponse.json({ success: true });
});
