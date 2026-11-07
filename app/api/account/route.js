/**
 * DELETE /api/account: delete everything health holds about the signed-in person (UK GDPR Article 17,
 * the right to erasure; withdrawing consent works the same way).
 *
 * Body: { confirm: "delete everything" }, so a stray request cannot do it.
 *
 * Removes every row the person owns in every table, then any space (family) they were the only member
 * of, with everything in it, then their membership and their user row. Nothing is kept in a "deleted"
 * state: the rows are gone. Database backups at Neon age out on Neon's own schedule (see docs/PRIVACY.md).
 *
 * The sign-in account itself lives at Kinde. Deleting it there needs Kinde's management API, which this
 * project does not use, so the response says so and docs/PRIVACY.md explains how it is removed.
 */
import { NextResponse } from "next/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import * as S from "@/utils/schema";
import { getKindeUser, safeMessage } from "@/lib/auth";

// Every table with a user_id column. tests/privacy/account.test.mjs fails if a new one is not listed here.
export const OWNED_TABLES = [
  "PLANS", "PLAN_DAYS", "PLAN_EXERCISES", "SESSIONS", "SESSION_SETS", "SLEEP_LOGS", "WATER_LOGS", "MOOD_LOGS",
  "FEELINGS", "APPOINTMENTS", "BODY_METRICS", "MEAL_LOGS", "CARDIO_LOGS", "CHAT_MESSAGES", "DAILY_CHECK_INS",
  "USER_CONTEXT", "DAILY_MINI_LOGS", "GOALS", "REMINDERS",
];
// Tables whose rows belong to a space (family). Emptied when the person was the space's only member.
const SPACE_TABLES = [...OWNED_TABLES, "EXERCISES", "INVITES", "PROFILE_VIEWS"];

export async function DELETE(req) {
  let user;
  try {
    user = await getKindeUser();
  } catch (e) {
    return NextResponse.json({ error: safeMessage(e) }, { status: 500 });
  }
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let body = null;
  try { body = await req.json(); } catch { /* checked below */ }
  if (body?.confirm !== "delete everything") {
    return NextResponse.json({ error: 'To delete everything, send { "confirm": "delete everything" }.' }, { status: 400 });
  }

  const id = user.id;
  try {
    // The spaces this person belongs to, and which of them have nobody else in them.
    const mine = await db.select({ familyId: S.MEMBERSHIPS.familyId }).from(S.MEMBERSHIPS).where(eq(S.MEMBERSHIPS.userId, id));
    const soleSpaces = [];
    for (const { familyId } of mine) {
      const members = await db.select({ userId: S.MEMBERSHIPS.userId }).from(S.MEMBERSHIPS).where(eq(S.MEMBERSHIPS.familyId, familyId));
      if (members.every((m) => m.userId === id)) soleSpaces.push(familyId);
    }

    for (const name of OWNED_TABLES) {
      const t = S[name];
      await db.delete(t).where(eq(t.userId, id));
    }
    if (soleSpaces.length) {
      for (const name of SPACE_TABLES) {
        const t = S[name];
        await db.delete(t).where(inArray(t.familyId, soleSpaces));
      }
    }
    await db.delete(S.PROFILE_VIEWS).where(or(eq(S.PROFILE_VIEWS.viewerId, id), eq(S.PROFILE_VIEWS.vieweeId, id)));
    await db.delete(S.INVITES).where(eq(S.INVITES.invitedByUserId, id));
    await db.delete(S.MEMBERSHIPS).where(eq(S.MEMBERSHIPS.userId, id));
    if (soleSpaces.length) {
      await db.delete(S.FAMILIES).where(and(inArray(S.FAMILIES.id, soleSpaces), eq(S.FAMILIES.ownerUserId, id)));
    }
    await db.delete(S.USERS).where(eq(S.USERS.id, id));
  } catch (e) {
    console.error("[account] delete failed:", e?.message ?? "unknown error");
    return NextResponse.json({ error: "Something went wrong, and not everything was deleted. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: "Everything you wrote down in health, your profile and your settings.",
    signIn: "Your sign-in account at Kinde is separate. Email michael@guilduk.com to have it removed too.",
  });
}
