/**
 * POST /api/invites/[token]/accept
 *
 * Authed Kinde user redeems an invite token. Server checks:
 *   - token exists
 *   - not already accepted / revoked / expired
 *   - signed-in email matches the invite email (case-insensitive)
 *
 * Then INSIDE the same logical request:
 *   - inserts a MEMBERSHIPS row binding the user to the family
 *   - stamps INVITES.acceptedAt + acceptedByUserId
 *
 * Drizzle on Neon doesn't expose a native transaction over the
 * @neondatabase/serverless driver, but the two writes are independent
 * enough that an extremely-unlikely partial failure (membership inserted
 * but invite not stamped) just means the user is now in the family AND
 * the invite is technically still pending — both branches recover on
 * the next request, and a duplicate accept attempt no-ops via the unique
 * (user_id, family_id) PK on memberships.
 *
 * Returns { ok: true, familyId, role } on success. The client uses
 * familyId to redirect into the right onboarding step.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { INVITES, MEMBERSHIPS } from "@/utils/schema";
import { requireKindeOnly } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(_req, { params }) {
  const token = params?.token;
  if (!token || typeof token !== "string" || token.length < 20) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  let auth;
  try {
    auth = await requireKindeOnly();
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
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
  if (invite.acceptedAt) {
    // Already accepted. If by the SAME user, treat as a happy idempotent
    // success (e.g. user double-clicks accept). If by a different user,
    // refuse — invites are single-use.
    if (invite.acceptedByUserId === auth.userId) {
      return NextResponse.json({
        ok: true,
        familyId: invite.familyId,
        role: invite.role,
        alreadyAccepted: true,
      });
    }
    return NextResponse.json(
      { error: "invite already accepted" },
      { status: 410 }
    );
  }
  if (invite.revokedAt) {
    return NextResponse.json(
      { error: "invite has been revoked" },
      { status: 410 }
    );
  }
  if (new Date(invite.expiresAt) <= now) {
    return NextResponse.json(
      { error: "invite has expired" },
      { status: 410 }
    );
  }

  // Email match - case-insensitive. The invite is bound to the address
  // the owner sent it to; you can't grab someone else's invite even with
  // the link.
  if (auth.email !== (invite.email ?? "").toLowerCase()) {
    return NextResponse.json(
      {
        error: "this invite is for a different email address",
        wantedEmail: invite.email,
        actualEmail: auth.email,
      },
      { status: 403 }
    );
  }

  // Insert membership. Composite PK on (user_id, family_id) means
  // ON CONFLICT DO NOTHING gives us idempotency for free if the user
  // somehow ended up in this family already.
  try {
    await db
      .insert(MEMBERSHIPS)
      .values({
        userId: auth.userId,
        familyId: invite.familyId,
        role: invite.role === "admin" ? "admin" : "member",
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error("[/api/invites/accept] membership insert failed:", err);
    return NextResponse.json(
      { error: "failed to join family" },
      { status: 500 }
    );
  }

  // Stamp the invite. If this fails we still consider the accept
  // successful from the user's POV (they have the membership) but log
  // loud — a stuck "pending" row is annoying for the inviter.
  try {
    await db
      .update(INVITES)
      .set({ acceptedAt: new Date(), acceptedByUserId: auth.userId })
      .where(eq(INVITES.id, invite.id));
  } catch (err) {
    console.error("[/api/invites/accept] invite stamp failed:", err);
  }

  return NextResponse.json({
    ok: true,
    familyId: invite.familyId,
    role: invite.role,
  });
}
