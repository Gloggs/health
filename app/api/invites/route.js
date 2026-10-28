/**
 * Invite create / list / revoke. Owner + admin only.
 *
 * GET    /api/invites          -> { invites: [...] } - pending only by default;
 *                                ?status=all returns accepted + revoked too
 * POST   /api/invites          -> create + (best-effort) email
 *                                body: { email, role?='member' }
 * DELETE /api/invites?id=<n>   -> revoke a pending invite
 *
 * No PUT - if you need to change role / expiry, revoke and re-issue. Keeps
 * the audit trail clean.
 */
import { NextResponse } from "next/server";
import { and, eq, desc, isNull } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { INVITES, MEMBERSHIPS, USERS, FAMILIES } from "@/utils/schema";
import { requireFamilyUser } from "@/lib/auth";
import { generateInviteToken } from "@/lib/tokens";
import { clampString } from "@/lib/validate";
import { sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Permission check: only owner / admin members of a family can manage
// invites. Returns the caller's role string or throws 403.
async function requireOwnerOrAdmin(userId, familyId) {
  const [m] = await db
    .select({ role: MEMBERSHIPS.role })
    .from(MEMBERSHIPS)
    .where(
      and(eq(MEMBERSHIPS.userId, userId), eq(MEMBERSHIPS.familyId, familyId))
    )
    .limit(1);
  if (!m || (m.role !== "owner" && m.role !== "admin")) {
    const err = new Error("only owner or admin can manage invites");
    err.status = 403;
    throw err;
  }
  return m.role;
}

export async function GET(req) {
  let auth;
  try {
    auth = await requireFamilyUser(req);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
  try {
    await requireOwnerOrAdmin(auth.userId, auth.familyId);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  const rows = await db
    .select()
    .from(INVITES)
    .where(eq(INVITES.familyId, auth.familyId))
    .orderBy(desc(INVITES.createdAt));

  const now = new Date();
  const decorated = rows.map((r) => {
    let derivedStatus;
    if (r.acceptedAt) derivedStatus = "accepted";
    else if (r.revokedAt) derivedStatus = "revoked";
    else if (new Date(r.expiresAt) <= now) derivedStatus = "expired";
    else derivedStatus = "pending";
    // Surface the join-link only for invites that are actually actionable.
    // Don't leak tokens for accepted / revoked / expired rows.
    const link =
      derivedStatus === "pending"
        ? `${process.env.APP_URL ?? ""}/join/${r.token}`
        : null;
    return { ...r, status: derivedStatus, link };
  });

  const filtered =
    status === "all" ? decorated : decorated.filter((r) => r.status === status);

  return NextResponse.json({ invites: filtered });
}

export async function POST(req) {
  let auth;
  try {
    auth = await requireFamilyUser(req);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
  try {
    await requireOwnerOrAdmin(auth.userId, auth.familyId);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  let email;
  try {
    email = clampString(body?.email, "email", 200);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  email = email.toLowerCase();
  // Loose email validation - we just want to catch typos, not RFC-compliance.
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  // Refuse roles outside the known set. Only owners can create admin
  // invites - keeps "elevate to admin" a deliberate act by the billing
  // payer.
  const role = body?.role === "admin" ? "admin" : "member";
  if (role === "admin") {
    const [m] = await db
      .select({ role: MEMBERSHIPS.role })
      .from(MEMBERSHIPS)
      .where(
        and(
          eq(MEMBERSHIPS.userId, auth.userId),
          eq(MEMBERSHIPS.familyId, auth.familyId)
        )
      )
      .limit(1);
    if (m?.role !== "owner") {
      return NextResponse.json(
        { error: "only the owner can invite admins" },
        { status: 403 }
      );
    }
  }

  // Don't invite someone who is already a member.
  const [existingUser] = await db
    .select({ id: USERS.id })
    .from(USERS)
    .where(eq(USERS.email, email))
    .limit(1);
  if (existingUser) {
    const [existingMembership] = await db
      .select()
      .from(MEMBERSHIPS)
      .where(
        and(
          eq(MEMBERSHIPS.userId, existingUser.id),
          eq(MEMBERSHIPS.familyId, auth.familyId)
        )
      )
      .limit(1);
    if (existingMembership) {
      return NextResponse.json(
        { error: "that email is already in this family" },
        { status: 409 }
      );
    }
  }

  // Refuse if there's already a pending (not accepted, not revoked, not
  // expired) invite for this email+family. Avoids inbox clutter.
  const [pending] = await db
    .select({ id: INVITES.id })
    .from(INVITES)
    .where(
      and(
        eq(INVITES.familyId, auth.familyId),
        eq(INVITES.email, email),
        isNull(INVITES.acceptedAt),
        isNull(INVITES.revokedAt)
      )
    )
    .limit(1);
  if (pending) {
    return NextResponse.json(
      { error: "an invite is already pending for that email - revoke it first to re-send" },
      { status: 409 }
    );
  }

  const token = generateInviteToken();
  // 14 days. Long enough that a busy family member can take a week to
  // notice; short enough that stale links don't accumulate forever.
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  let row;
  try {
    [row] = await db
      .insert(INVITES)
      .values({
        token,
        familyId: auth.familyId,
        email,
        role,
        invitedByUserId: auth.userId,
        expiresAt,
      })
      .returning();
  } catch (err) {
    console.error("[/api/invites POST] insert failed:", err);
    return NextResponse.json(
      { error: "failed to create invite" },
      { status: 500 }
    );
  }

  // Best-effort email send. Failures don't block the API response - the
  // UI surfaces the join-link so the inviter can copy + share manually
  // if Resend isn't configured / the email bounces.
  let emailDelivered = false;
  let emailError = null;
  try {
    const [family] = await db
      .select({ name: FAMILIES.name })
      .from(FAMILIES)
      .where(eq(FAMILIES.id, auth.familyId))
      .limit(1);
    const [inviter] = await db
      .select({ displayName: USERS.displayName, email: USERS.email })
      .from(USERS)
      .where(eq(USERS.id, auth.userId))
      .limit(1);
    const result = await sendInviteEmail({
      to: email,
      familyName: family?.name ?? "Health",
      inviterName: inviter?.displayName ?? inviter?.email ?? "your family",
      joinUrl: `${process.env.APP_URL ?? ""}/join/${token}`,
    });
    emailDelivered = !!result.delivered;
    emailError = result.error ?? null;
  } catch (err) {
    console.error("[/api/invites POST] email send threw:", err);
    emailError = "email-send-threw";
  }

  return NextResponse.json({
    ok: true,
    invite: {
      ...row,
      status: "pending",
      link: `${process.env.APP_URL ?? ""}/join/${token}`,
    },
    emailDelivered,
    emailError,
  });
}

export async function DELETE(req) {
  let auth;
  try {
    auth = await requireFamilyUser(req);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
  try {
    await requireOwnerOrAdmin(auth.userId, auth.familyId);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // Soft-delete: stamp revokedAt rather than removing the row, so the
  // link can't be resurrected and the audit trail survives.
  const [row] = await db
    .update(INVITES)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(INVITES.id, id),
        eq(INVITES.familyId, auth.familyId),
        isNull(INVITES.acceptedAt),
        isNull(INVITES.revokedAt)
      )
    )
    .returning();
  if (!row) {
    return NextResponse.json(
      { error: "invite not found or already settled" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
