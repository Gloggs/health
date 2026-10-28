import { NextResponse } from "next/server";
import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { CHAT_MESSAGES, USERS, MEMBERSHIPS } from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET /api/family/chat?limit=100&before=<id>
// Shared family room. Response shape:
//   { messages: [...], typing: [{ id, displayName }, ...] }
//
// Family scoping (F1 / B.3): both the message stream and the typing list
// are scoped to the viewer's family. Typing uses a USERS+MEMBERSHIPS join
// so users in other families never appear in the family-A typing state.
export const GET = withFamily(async (req, _ctx, { viewerId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 200);
  const before = Number(sp.get("before")) || null;

  const filters = [familyFilter(CHAT_MESSAGES, familyId), eq(CHAT_MESSAGES.kind, "family")];
  if (before && Number.isFinite(before)) {
    filters.push(lt(CHAT_MESSAGES.id, before));
  }

  const [messages, typing] = await Promise.all([
    db
      .select({
        id: CHAT_MESSAGES.id,
        userId: CHAT_MESSAGES.userId,
        date: CHAT_MESSAGES.date,
        content: CHAT_MESSAGES.content,
        createdAt: CHAT_MESSAGES.createdAt,
        authorName: USERS.displayName,
      })
      .from(CHAT_MESSAGES)
      .leftJoin(USERS, eq(USERS.id, CHAT_MESSAGES.userId))
      .where(and(...filters))
      .orderBy(desc(CHAT_MESSAGES.createdAt))
      .limit(limit),
    // Family-scoped typing query - USERS+MEMBERSHIPS join replaces the
    // A.3 TODO(F1) comment. Now multi-tenant-safe by construction.
    db
      .select({
        id: USERS.id,
        displayName: USERS.displayName,
      })
      .from(USERS)
      .innerJoin(MEMBERSHIPS, eq(MEMBERSHIPS.userId, USERS.id))
      .where(
        and(
          eq(MEMBERSHIPS.familyId, familyId),
          ne(USERS.id, viewerId),
          gt(USERS.typingUntil, sql`now()`)
        )
      ),
  ]);

  return NextResponse.json({ messages, typing });
});

// POST /api/family/chat
// Writes a new family-room message under the signed-in viewer's id.
export const POST = withFamily(async (req, _ctx, { viewerId, familyId }) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const content = clampString(body?.content, "content");
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const [inserted] = await db
    .insert(CHAT_MESSAGES)
    .values({
      userId: viewerId,
      familyId,
      date: localToday,
      content,
      source: "user",
      kind: "family",
    })
    .returning();

  // Re-pull with the author name joined in so the client can paint the
  // optimistic row without a follow-up roster lookup.
  const [withName] = await db
    .select({
      id: CHAT_MESSAGES.id,
      userId: CHAT_MESSAGES.userId,
      date: CHAT_MESSAGES.date,
      content: CHAT_MESSAGES.content,
      createdAt: CHAT_MESSAGES.createdAt,
      authorName: USERS.displayName,
    })
    .from(CHAT_MESSAGES)
    .leftJoin(USERS, eq(USERS.id, CHAT_MESSAGES.userId))
    .where(eq(CHAT_MESSAGES.id, inserted.id))
    .limit(1);

  return NextResponse.json(withName ?? inserted);
});

// DELETE /api/family/chat?id=N
// Authors can remove their own messages from the family room.
export const DELETE = withFamily(async (req, _ctx, { viewerId, familyId }) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id || !Number.isFinite(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const removed = await db
    .delete(CHAT_MESSAGES)
    .where(
      and(
        familyFilter(CHAT_MESSAGES, familyId),
        eq(CHAT_MESSAGES.id, id),
        eq(CHAT_MESSAGES.userId, viewerId),
        eq(CHAT_MESSAGES.kind, "family")
      )
    )
    .returning({ id: CHAT_MESSAGES.id });
  return NextResponse.json({ ok: true, deleted: removed.length });
});
