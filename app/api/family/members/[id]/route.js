/**
 * Per-member operations: change role, remove from family.
 *
 *   PATCH  /api/family/members/[id]     -> change role (owner only)
 *                                          body: { role: 'admin'|'member' }
 *   DELETE /api/family/members/[id]     -> remove from family
 *                                          (owner removes anyone, admin removes
 *                                           members only)
 *
 * `id` is the target user's id (the USERS.id / Kinde sub being acted on),
 * not the membership row id. Kept in the URL so the actor (auth.userId)
 * stays implicit and the URL is self-documenting.
 *
 * Constraints baked in:
 *   - You can't change your own role here. Use /api/family/leave to walk
 *     away cleanly; transferring ownership is its own deliberate action
 *     (deferred to a future endpoint).
 *   - You can't demote the family's last owner — a family must always
 *     have exactly one owner. Promote someone else first.
 *   - You can't remove the owner via this endpoint (they leave via the
 *     transfer-ownership flow, also deferred).
 *   - Admins can remove regular members but not other admins. Owner can
 *     remove any non-owner role.
 *
 * Removal cascades nothing — health data stays attached to the user's
 * row in case they re-join (or for export later). The MEMBERSHIPS row is
 * deleted; the user retains their USERS row + all logged data, just
 * can't see family content until re-invited. Matches the "data is yours
 * forever" promise.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { MEMBERSHIPS, USERS } from "@/utils/schema";
import { requireFamilyUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["admin", "member"]);

async function loadMembership(userId, familyId) {
  const [m] = await db
    .select({ userId: MEMBERSHIPS.userId, role: MEMBERSHIPS.role })
    .from(MEMBERSHIPS)
    .where(and(eq(MEMBERSHIPS.userId, userId), eq(MEMBERSHIPS.familyId, familyId)))
    .limit(1);
  return m ?? null;
}

export async function PATCH(req, { params }) {
  let auth;
  try {
    auth = await requireFamilyUser(req);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const targetUserId = params?.id;
  if (!targetUserId) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  if (targetUserId === auth.userId) {
    return NextResponse.json(
      { error: "you can't change your own role" },
      { status: 400 }
    );
  }

  // Actor permission: only the owner can re-rank members. Admins inviting
  // is fine, but admins promoting other admins would let them mint power
  // without the billing payer's consent. Locked to owner.
  const actor = await loadMembership(auth.userId, auth.familyId);
  if (!actor || actor.role !== "owner") {
    return NextResponse.json(
      { error: "only the family owner can change roles" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const role = body?.role;
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json(
      { error: "role must be 'admin' or 'member'" },
      { status: 400 }
    );
  }

  const target = await loadMembership(targetUserId, auth.familyId);
  if (!target) {
    return NextResponse.json(
      { error: "that user isn't in your family" },
      { status: 404 }
    );
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "the owner's role can't be changed here" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(MEMBERSHIPS)
    .set({ role })
    .where(
      and(
        eq(MEMBERSHIPS.userId, targetUserId),
        eq(MEMBERSHIPS.familyId, auth.familyId)
      )
    )
    .returning();

  return NextResponse.json({ ok: true, membership: updated });
}

export async function DELETE(req, { params }) {
  let auth;
  try {
    auth = await requireFamilyUser(req);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const targetUserId = params?.id;
  if (!targetUserId) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  if (targetUserId === auth.userId) {
    // Self-removal goes through /api/family/leave — keeps the "I'm
    // leaving voluntarily" path distinct from "I'm being kicked out" in
    // both UX and audit logs.
    return NextResponse.json(
      { error: "use /api/family/leave to leave the family yourself" },
      { status: 400 }
    );
  }

  const actor = await loadMembership(auth.userId, auth.familyId);
  if (!actor || (actor.role !== "owner" && actor.role !== "admin")) {
    return NextResponse.json(
      { error: "only owner or admin can remove members" },
      { status: 403 }
    );
  }

  const target = await loadMembership(targetUserId, auth.familyId);
  if (!target) {
    return NextResponse.json(
      { error: "that user isn't in your family" },
      { status: 404 }
    );
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "the family owner can't be removed" },
      { status: 400 }
    );
  }
  // Admins removing other admins would let an admin neutralise an equal-
  // ranked peer; reserve that authority for the owner.
  if (target.role === "admin" && actor.role !== "owner") {
    return NextResponse.json(
      { error: "only the owner can remove an admin" },
      { status: 403 }
    );
  }

  await db
    .delete(MEMBERSHIPS)
    .where(
      and(
        eq(MEMBERSHIPS.userId, targetUserId),
        eq(MEMBERSHIPS.familyId, auth.familyId)
      )
    );

  // For the toast / audit trail. We don't return the deleted target's
  // email (we don't have it loaded) — just enough for the UI to remove
  // the tile optimistically.
  return NextResponse.json({ ok: true, removedUserId: targetUserId });
}
