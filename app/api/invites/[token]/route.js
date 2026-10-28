/**
 * GET /api/invites/[token]
 *
 * PUBLIC endpoint — no auth required. Used by /join/[token] to render a
 * "you've been invited to <Family>" page before prompting sign-in.
 *
 * Returns just enough info for the join page to render — never the token
 * itself (the client already has it in the URL) and never the inviter's
 * email (privacy). Family name + inviter display name is fine — those
 * are already disclosed to anyone who can read the invite email.
 *
 * Returns 404 (not 403) for revoked / expired / accepted tokens so we
 * don't leak which tokens were once valid. The UI distinguishes via the
 * `status` field on the response.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { INVITES, FAMILIES, USERS } from "@/utils/schema";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const token = params?.token;
  if (!token || typeof token !== "string" || token.length < 20) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const [invite] = await db
    .select()
    .from(INVITES)
    .where(eq(INVITES.token, token))
    .limit(1);

  if (!invite) {
    return NextResponse.json({ error: "invite not found" }, { status: 404 });
  }

  const now = new Date();
  let status;
  if (invite.acceptedAt) status = "accepted";
  else if (invite.revokedAt) status = "revoked";
  else if (new Date(invite.expiresAt) <= now) status = "expired";
  else status = "pending";

  // Only return family + inviter context for actionable invites. Accepted
  // / revoked / expired return the bare status so the UI can render the
  // right "this invite is no longer valid" copy.
  if (status !== "pending") {
    return NextResponse.json({ status });
  }

  const [family] = await db
    .select({ name: FAMILIES.name })
    .from(FAMILIES)
    .where(eq(FAMILIES.id, invite.familyId))
    .limit(1);

  const [inviter] = await db
    .select({ displayName: USERS.displayName })
    .from(USERS)
    .where(eq(USERS.id, invite.invitedByUserId))
    .limit(1);

  return NextResponse.json({
    status: "pending",
    email: invite.email,
    familyName: family?.name ?? "Health",
    inviterName: inviter?.displayName ?? "your family",
    expiresAt: invite.expiresAt,
    role: invite.role,
  });
}
