import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { PROFILE_VIEWS, USERS } from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";
import { daysAgoStr, todayDateStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

// GET /api/family/views?direction=inbound|outbound|all&limit=30
export const GET = withFamily(async (req, _ctx, { viewerId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const direction = sp.get("direction") || "all";
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));
  const since = daysAgoStr(30);

  const wantInbound = direction === "all" || direction === "inbound";
  const wantOutbound = direction === "all" || direction === "outbound";
  const wantUnread = direction === "all" || direction === "inbound";

  const [inboundRows, outboundRows, unreadRow] = await Promise.all([
    wantInbound
      ? db
          .select({
            id: PROFILE_VIEWS.id,
            date: PROFILE_VIEWS.date,
            readAt: PROFILE_VIEWS.readAt,
            createdAt: PROFILE_VIEWS.createdAt,
            viewerId: PROFILE_VIEWS.viewerId,
            viewerName: USERS.displayName,
          })
          .from(PROFILE_VIEWS)
          .leftJoin(USERS, eq(USERS.id, PROFILE_VIEWS.viewerId))
          .where(
            and(familyFilter(PROFILE_VIEWS, familyId), eq(PROFILE_VIEWS.vieweeId, viewerId), gte(PROFILE_VIEWS.date, since))
          )
          .orderBy(desc(PROFILE_VIEWS.date), desc(PROFILE_VIEWS.createdAt))
          .limit(limit)
      : Promise.resolve([]),
    wantOutbound
      ? db
          .select({
            id: PROFILE_VIEWS.id,
            date: PROFILE_VIEWS.date,
            createdAt: PROFILE_VIEWS.createdAt,
            vieweeId: PROFILE_VIEWS.vieweeId,
            vieweeName: USERS.displayName,
          })
          .from(PROFILE_VIEWS)
          .leftJoin(USERS, eq(USERS.id, PROFILE_VIEWS.vieweeId))
          .where(
            and(familyFilter(PROFILE_VIEWS, familyId), eq(PROFILE_VIEWS.viewerId, viewerId), gte(PROFILE_VIEWS.date, since))
          )
          .orderBy(desc(PROFILE_VIEWS.date), desc(PROFILE_VIEWS.createdAt))
          .limit(limit)
      : Promise.resolve([]),
    wantUnread
      ? db
          .select({ count: sql`COUNT(*)::int`.as("count") })
          .from(PROFILE_VIEWS)
          .where(
            and(familyFilter(PROFILE_VIEWS, familyId), eq(PROFILE_VIEWS.vieweeId, viewerId), isNull(PROFILE_VIEWS.readAt))
          )
          .then((r) => r[0] ?? { count: 0 })
      : Promise.resolve({ count: 0 }),
  ]);

  return NextResponse.json({
    inbound: inboundRows,
    outbound: outboundRows,
    unreadCount: Number(unreadRow.count) || 0,
  });
});

// POST /api/family/views - records that the signed-in viewer opened
// another family member's profile today.
export const POST = withFamily(async (req, _ctx, { viewerId, familyId }) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const vieweeId = String(body?.vieweeId ?? "").trim();
  if (!vieweeId) {
    return NextResponse.json({ error: "vieweeId required" }, { status: 400 });
  }
  if (vieweeId === viewerId) {
    return NextResponse.json({ ok: true, self: true });
  }

  const [exists] = await db
    .select({ id: USERS.id })
    .from(USERS)
    .where(eq(USERS.id, vieweeId))
    .limit(1);
  if (!exists) {
    return NextResponse.json({ error: "viewee not found" }, { status: 404 });
  }

  const date = todayDateStr();
  const inserted = await db
    .insert(PROFILE_VIEWS)
    .values({ viewerId, vieweeId, familyId, date })
    .onConflictDoNothing({
      target: [PROFILE_VIEWS.viewerId, PROFILE_VIEWS.vieweeId, PROFILE_VIEWS.date],
    })
    .returning({ id: PROFILE_VIEWS.id });

  return NextResponse.json({ ok: true, pinged: inserted.length > 0 });
});
