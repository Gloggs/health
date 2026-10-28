import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { USERS } from "@/utils/schema";
import { withFamily } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/family/chat/typing
// Bumps the signed-in user's `typing_until` timestamp to NOW() + 5s.
// The chat GET surfaces anyone with typing_until > now as an active
// typer in the response. Idempotent - posting repeatedly while you
// type just keeps refreshing the deadline.
//
// Uses withFamily (not withFamilyWrite): writing to your own typing
// indicator is the viewer's own act, same category as PingProfileView
// and MarkViewsRead - not blocked by the no-writes-while-viewing rule.
//
// Client debounces keystrokes to ~one POST per 800ms; the 5s window
// keeps the indicator alive across reasonable typing pauses.
export const POST = withFamily(async (_req, _ctx, { viewerId }) => {
  const until = new Date(Date.now() + 5_000);
  await db
    .update(USERS)
    .set({ typingUntil: until })
    .where(eq(USERS.id, viewerId));
  return NextResponse.json({ ok: true, until: until.toISOString() });
});
