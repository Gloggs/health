/**
 * POST /api/family/leave
 *
 * Self-leave. Deletes the caller's MEMBERSHIPS row for their current
 * family. After leaving they'll bounce to /onboarding on next request
 * (no membership → onboarding flow).
 *
 * Refused when:
 *   - The caller is the owner. Owners must transfer ownership first
 *     (deferred to a future endpoint). Without that guard the family
 *     would be left ownerless, breaking billing + admin permissions.
 *     Exception: if the owner is the only member, leaving is allowed
 *     because no one else is affected — we treat it as "delete the
 *     family" semantically (the FAMILIES row stays for audit; no UI
 *     surfaces it once membership is gone).
 *
 * Data retention: as with admin-kick removal, the user's USERS row +
 * health-table rows stay. They keep their data ownership; they just
 * can't see family content. Re-joining via a fresh invite restores
 * access without losing history.
 */
import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { MEMBERSHIPS } from "@/utils/schema";
import { requireFamilyUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let auth;
  try {
    auth = await requireFamilyUser(req);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  // Re-load my membership row so we know if I'm the owner.
  const [me] = await db
    .select({ role: MEMBERSHIPS.role })
    .from(MEMBERSHIPS)
    .where(
      and(
        eq(MEMBERSHIPS.userId, auth.userId),
        eq(MEMBERSHIPS.familyId, auth.familyId)
      )
    )
    .limit(1);
  if (!me) {
    return NextResponse.json({ error: "not in this family" }, { status: 404 });
  }

  // Owner can only leave when no one else is in the family (effectively
  // dissolves their solo-family) — otherwise they must transfer first.
  if (me.role === "owner") {
    const [{ count }] = await db
      .select({ count: sql`COUNT(*)::int`.as("count") })
      .from(MEMBERSHIPS)
      .where(
        and(
          eq(MEMBERSHIPS.familyId, auth.familyId),
          ne(MEMBERSHIPS.userId, auth.userId)
        )
      );
    if (count > 0) {
      return NextResponse.json(
        {
          error:
            "as the owner, transfer ownership to another member before leaving",
        },
        { status: 400 }
      );
    }
  }

  await db
    .delete(MEMBERSHIPS)
    .where(
      and(
        eq(MEMBERSHIPS.userId, auth.userId),
        eq(MEMBERSHIPS.familyId, auth.familyId)
      )
    );

  return NextResponse.json({ ok: true });
}
