import { NextResponse } from "next/server";
import { and, eq, gte, lt, lte, desc, ilike } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { CHAT_MESSAGES, USER_CONTEXT } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

// Run the per-user retention purge before reads. Cheap when each user's
// table slice is small; avoids a separate cron. Scoped strictly to the
// caller's user_id AND kind='journal' so the family-room stream is
// never touched by a journal-retention setting.
async function applyRetention(userId, familyId) {
  const [ctx] = await db
    .select()
    .from(USER_CONTEXT)
    .where(and(familyFilter(USER_CONTEXT, familyId), eq(USER_CONTEXT.userId, userId)))
    .limit(1);
  const days = Number(ctx?.chatRetentionDays);
  if (!days || days <= 0) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(cutoff.getDate()).padStart(2, "0")}`;
  await db
    .delete(CHAT_MESSAGES)
    .where(
      and(
        familyFilter(CHAT_MESSAGES, familyId),
        eq(CHAT_MESSAGES.userId, userId),
        eq(CHAT_MESSAGES.kind, "journal"),
        lt(CHAT_MESSAGES.date, cutoffStr)
      )
    );
}

// GET ?from=&to=&q=&limit=
// JOURNAL ONLY. Filters by kind='journal' AND user_id so the family-room
// stream (kind='family') is never returned here - that lives at
// /api/family/chat. Always private regardless of Phase 2 viewing state.
export const GET = withFamily(async (req, _ctx, { userId, familyId }) => {
  await applyRetention(userId, familyId);

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const q = sp.get("q");
  const limit = Math.min(Number(sp.get("limit") ?? 200), 1000);

  const filters = [
    familyFilter(CHAT_MESSAGES, familyId),
    eq(CHAT_MESSAGES.userId, userId),
    eq(CHAT_MESSAGES.kind, "journal"),
  ];
  if (from) filters.push(gte(CHAT_MESSAGES.date, from));
  if (to) filters.push(lte(CHAT_MESSAGES.date, to));
  if (q) filters.push(ilike(CHAT_MESSAGES.content, "%" + q + "%"));

  const rows = await db
    .select()
    .from(CHAT_MESSAGES)
    .where(and(...filters))
    .orderBy(desc(CHAT_MESSAGES.createdAt))
    .limit(limit);
  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  // clampString trims + bounds; if it returns null the field was empty.
  const content = clampString(body.content, "content");
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  // Default to server-local date so the day boundary matches calendar
  // expectations (UTC slice could roll over a day for users west of UTC).
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const date = body.date ?? localToday;
  const [row] = await db
    .insert(CHAT_MESSAGES)
    .values({
      userId,
      familyId,
      date,
      content,
      source: body.source ?? "user",
      tags: body.tags ?? null,
      redacted: !!body.redacted,
      kind: "journal",
    })
    .returning();
  return NextResponse.json(row);
});

// Partial update - currently used for redact + edit content. Always
// scoped to kind='journal' so an id passed from somewhere else can't
// mutate a family-room message via this endpoint.
export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const update = {};
  if ("redacted" in body) update.redacted = !!body.redacted;
  if ("content" in body) update.content = clampString(body.content, "content");
  if ("tags" in body) update.tags = body.tags ?? null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }
  const [row] = await db
    .update(CHAT_MESSAGES)
    .set(update)
    .where(
      and(
        familyFilter(CHAT_MESSAGES, familyId),
        eq(CHAT_MESSAGES.id, body.id),
        eq(CHAT_MESSAGES.userId, userId),
        eq(CHAT_MESSAGES.kind, "journal")
      )
    )
    .returning();
  return NextResponse.json(row ?? null);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(CHAT_MESSAGES)
    .where(
      and(
        familyFilter(CHAT_MESSAGES, familyId),
        eq(CHAT_MESSAGES.id, Number(id)),
        eq(CHAT_MESSAGES.userId, userId),
        eq(CHAT_MESSAGES.kind, "journal")
      )
    );
  return NextResponse.json({ success: true });
});
