import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { PLANS } from "@/utils/schema";
import { withFamilyWrite, familyFilter } from "@/lib/auth";

// POST /api/plans/[id]/activate - make this the active plan for THIS user,
// deactivate the user's other plans. Stamps activatedAt so the dashboard
// endpoint can auto-expire one-off plans (repeatWeekly = false) after 7 days.
export const POST = withFamilyWrite(async (_req, { params }, { userId, familyId }) => {
  const planId = Number(params.id);
  if (!planId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  // Ownership check - reject activation of a plan you don't own.
  const [owned] = await db
    .select({ id: PLANS.id })
    .from(PLANS)
    .where(and(familyFilter(PLANS, familyId), eq(PLANS.id, planId), eq(PLANS.userId, userId)))
    .limit(1);
  if (!owned) return NextResponse.json({ error: "plan not found" }, { status: 404 });

  await db
    .update(PLANS)
    .set({ isActive: false })
    .where(and(familyFilter(PLANS, familyId), eq(PLANS.userId, userId), ne(PLANS.id, planId)));
  const [row] = await db
    .update(PLANS)
    .set({ isActive: true, activatedAt: new Date() })
    .where(and(familyFilter(PLANS, familyId), eq(PLANS.id, planId), eq(PLANS.userId, userId)))
    .returning();

  return NextResponse.json(row);
});
