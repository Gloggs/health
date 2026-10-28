import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { PROFILE_VIEWS } from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/family/views/read
// Marks every unread inbound profile-view for the signed-in user as read
// (stamps `read_at = now()` on rows where vieweeId = me AND read_at IS
// NULL). The bell's badge clears as soon as the notifications panel
// opens; this endpoint is what makes that stick across reloads.
export const POST = withFamily(async (_req, _ctx, { viewerId, familyId }) => {
  const updated = await db
    .update(PROFILE_VIEWS)
    .set({ readAt: new Date() })
    .where(and(familyFilter(PROFILE_VIEWS, familyId), eq(PROFILE_VIEWS.vieweeId, viewerId), isNull(PROFILE_VIEWS.readAt)))
    .returning({ id: PROFILE_VIEWS.id });
  return NextResponse.json({ ok: true, markedCount: updated.length });
});
