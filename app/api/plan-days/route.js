import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { PLAN_DAYS, PLANS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

// PUT /api/plan-days - upsert label for a (plan, dayIndex) pair, scoped
// to the calling user. Rejects updates to plans owned by another family
// member with a 404.
export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.planId || body.dayIndex === undefined || body.dayIndex === null) {
    return NextResponse.json({ error: "planId and dayIndex required" }, { status: 400 });
  }
  const label = clampString(body.label, "label") || "Rest";

  // Confirm the user owns the parent plan before mutating any day rows.
  const [parent] = await db
    .select({ id: PLANS.id })
    .from(PLANS)
    .where(and(familyFilter(PLANS, familyId), eq(PLANS.id, body.planId), eq(PLANS.userId, userId)))
    .limit(1);
  if (!parent) return NextResponse.json({ error: "plan not found" }, { status: 404 });

  const existing = await db
    .select()
    .from(PLAN_DAYS)
    .where(
      and(
        familyFilter(PLAN_DAYS, familyId),
        eq(PLAN_DAYS.userId, userId),
        eq(PLAN_DAYS.planId, body.planId),
        eq(PLAN_DAYS.dayIndex, body.dayIndex)
      )
    )
    .limit(1);

  if (existing[0]) {
    const [row] = await db
      .update(PLAN_DAYS)
      .set({ label })
      .where(and(familyFilter(PLAN_DAYS, familyId), eq(PLAN_DAYS.id, existing[0].id), eq(PLAN_DAYS.userId, userId)))
      .returning();
    return NextResponse.json(row);
  }

  const [row] = await db
    .insert(PLAN_DAYS)
    .values({ userId, familyId, planId: body.planId, dayIndex: body.dayIndex, label })
    .returning();
  return NextResponse.json(row);
});
