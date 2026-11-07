/**
 * POST /api/family/create
 *
 * First-run onboarding endpoint. Creates a new FAMILIES row owned by the
 * signed-in user, then a MEMBERSHIPS row binding the user to that family
 * with role='owner'.
 *
 * Refuses if the caller already has a membership — the UI flow that
 * leads here only fires from /onboarding which is itself gated behind
 * "no membership", but we guard server-side too so a stray POST can't
 * silently spawn duplicate families.
 *
 * Body:
 *   { name: "The Smiths" }  // 2..60 chars, trimmed
 *
 * Returns:
 *   { ok: true, familyId, role: 'owner' }
 */
import { NextResponse } from "next/server";
import { db } from "@/utils/dbConfig";
import { FAMILIES, MEMBERSHIPS, USERS } from "@/utils/schema";
import { eq } from "drizzle-orm";
import { requireKindeOnly, safeMessage } from "@/lib/auth";
import { generateFamilyId } from "@/lib/tokens";
import { clampString } from "@/lib/validate";
import { FAMILY_SHARING } from "@/lib/features";

export async function POST(req) {
  let auth;
  try {
    // The verified-email rule protects invites; with family sharing off there are none.
    auth = await requireKindeOnly({ requireVerified: FAMILY_SHARING });
  } catch (e) {
    return NextResponse.json({ error: safeMessage(e) }, { status: e.status ?? 500 });
  }

  const [me] = await db.select({ healthConsentAt: USERS.healthConsentAt }).from(USERS).where(eq(USERS.id, auth.userId)).limit(1);
  if (!me?.healthConsentAt) {
    return NextResponse.json({ error: "Please agree to how health stores your health information first." }, { status: 403 });
  }

  if (auth.hasFamily) {
    return NextResponse.json(
      { error: "user already belongs to a family", familyId: auth.familyId },
      { status: 409 }
    );
  }

  let body = {};
  if (FAMILY_SHARING) {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
  }

  // Family sharing off: every account gets a private space of its own, with a fixed name nobody sees.
  let name = FAMILY_SHARING ? null : "My space";
  if (FAMILY_SHARING) {
    try {
      name = clampString(body?.name, "name", 60);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: e.status ?? 400 });
    }
  }
  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "family name must be 2-60 characters" },
      { status: 400 }
    );
  }

  const familyId = generateFamilyId();

  try {
    await db.insert(FAMILIES).values({
      id: familyId,
      name,
      ownerUserId: auth.userId,
      billingPlan: null,
      billingExternalId: null,
    });
    await db.insert(MEMBERSHIPS).values({
      userId: auth.userId,
      familyId,
      role: "owner",
    });
  } catch (err) {
    console.error("[/api/family/create] failed:", err);
    return NextResponse.json(
      { error: "failed to create family" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, familyId, role: "owner" });
}
