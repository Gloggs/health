// The GP summary for the signed-in person only: their own words, arranged by lib/summary.js.
// Never for anyone else, not even family who can see their numbers.
import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { FEELINGS, SLEEP_LOGS, MOOD_LOGS, APPOINTMENTS, USERS } from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";
import { buildSummary } from "@/lib/summary";
import { todayDateStr, daysAgoStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const GET = withFamily(async (req, _ctx, { viewerId, isViewingOther, familyId }) => {
  if (isViewingOther) return NextResponse.json({ error: "A summary is only for the person who wrote it." }, { status: 403 });
  const weeks = Math.min(26, Math.max(1, Number(req.nextUrl.searchParams.get("weeks")) || 4));
  const to = todayDateStr();
  const from = daysAgoStr(weeks * 7 - 1);
  const mine = (t) => and(familyFilter(t, familyId), eq(t.userId, viewerId), gte(t.date, from), lte(t.date, to));
  const [feelings, sleep, mood, [appointment], [me]] = await Promise.all([
    db.select().from(FEELINGS).where(mine(FEELINGS)),
    db.select().from(SLEEP_LOGS).where(mine(SLEEP_LOGS)),
    db.select().from(MOOD_LOGS).where(mine(MOOD_LOGS)),
    db.select().from(APPOINTMENTS).where(and(familyFilter(APPOINTMENTS, familyId), eq(APPOINTMENTS.userId, viewerId))).limit(1),
    db.select({ displayName: USERS.displayName }).from(USERS).where(eq(USERS.id, viewerId)).limit(1),
  ]);
  return NextResponse.json(buildSummary({ name: me?.displayName ?? null, today: to, from, to, feelings, sleep, mood, appointment }));
});
