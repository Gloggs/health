import { NextResponse } from "next/server";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { DAILY_MINI_LOGS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";

// Daily Mini logs - the "Daily 4" rep counter on Today. One row per (user, date, slot).
// POST upserts on (user, date, slot): if a row exists, count is updated; else inserted.
// Set count: 0 to clear.
export const dynamic = "force-dynamic";

export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date");
  const from = sp.get("from");
  const to = sp.get("to");

  if (date) {
    const rows = await db
      .select()
      .from(DAILY_MINI_LOGS)
      .where(and(familyFilter(DAILY_MINI_LOGS, familyId), eq(DAILY_MINI_LOGS.userId, userId), eq(DAILY_MINI_LOGS.date, date)))
      .orderBy(asc(DAILY_MINI_LOGS.slot));
    return NextResponse.json(rows);
  }

  const filters = [familyFilter(DAILY_MINI_LOGS, familyId), eq(DAILY_MINI_LOGS.userId, userId)];
  if (from) filters.push(gte(DAILY_MINI_LOGS.date, from));
  if (to) filters.push(lte(DAILY_MINI_LOGS.date, to));

  const rows = await db
    .select()
    .from(DAILY_MINI_LOGS)
    .where(and(...filters))
    .orderBy(asc(DAILY_MINI_LOGS.date), asc(DAILY_MINI_LOGS.slot));
  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.date) return NextResponse.json({ error: "date is required" }, { status: 400 });
  const slot = Number(body.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) {
    return NextResponse.json({ error: "slot must be 0..3" }, { status: 400 });
  }
  const count = Math.max(0, Math.floor(Number(body.count) || 0));

  // Upsert on (user, date, slot). Read-then-update-or-insert is safe for the
  // single-user-per-row pattern: no two requests from the same user race here
  // for the same key.
  const [existing] = await db
    .select()
    .from(DAILY_MINI_LOGS)
    .where(
      and(
        familyFilter(DAILY_MINI_LOGS, familyId),
        eq(DAILY_MINI_LOGS.userId, userId),
        eq(DAILY_MINI_LOGS.date, body.date),
        eq(DAILY_MINI_LOGS.slot, slot)
      )
    )
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(DAILY_MINI_LOGS)
      .set({ count, updatedAt: new Date() })
      .where(and(familyFilter(DAILY_MINI_LOGS, familyId), eq(DAILY_MINI_LOGS.id, existing.id), eq(DAILY_MINI_LOGS.userId, userId)))
      .returning();
    return NextResponse.json(row);
  }
  const [row] = await db
    .insert(DAILY_MINI_LOGS)
    .values({ userId, familyId, date: body.date, slot, count })
    .returning();
  return NextResponse.json(row);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  if (id) {
    await db
      .delete(DAILY_MINI_LOGS)
      .where(and(familyFilter(DAILY_MINI_LOGS, familyId), eq(DAILY_MINI_LOGS.id, Number(id)), eq(DAILY_MINI_LOGS.userId, userId)));
    return NextResponse.json({ success: true });
  }
  const date = sp.get("date");
  const slot = sp.get("slot");
  if (date && slot != null) {
    await db
      .delete(DAILY_MINI_LOGS)
      .where(
        and(
          familyFilter(DAILY_MINI_LOGS, familyId),
          eq(DAILY_MINI_LOGS.userId, userId),
          eq(DAILY_MINI_LOGS.date, date),
          eq(DAILY_MINI_LOGS.slot, Number(slot))
        )
      );
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "id or (date, slot) required" }, { status: 400 });
});
