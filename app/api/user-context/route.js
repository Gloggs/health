import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { USER_CONTEXT } from "@/utils/schema";
import { normaliseMiniExercises } from "@/lib/mini";
import { normaliseContainers } from "@/lib/usuals";
import { normalisePersonality } from "@/lib/personality";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

// One context row per family member (scoped by userId). Auto-creates on
// first call so the Coach tab and onboarding can both read-then-write
// safely without an explicit init step.
async function ensureRowForUser(userId, familyId) {
  const [existing] = await db
    .select()
    .from(USER_CONTEXT)
    .where(and(familyFilter(USER_CONTEXT, familyId), eq(USER_CONTEXT.userId, userId)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(USER_CONTEXT)
    .values({
      userId,
      familyId,
      goals: "",
      restrictions: "",
      preferences: "",
    })
    .returning();
  return created;
}

export const GET = withFamily(async (_req, _ctx, { userId, familyId }) => {
  const row = await ensureRowForUser(userId, familyId);
  return NextResponse.json(row);
});

export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  const row = await ensureRowForUser(userId, familyId);
  // Use `in body` to distinguish "not sent" from explicit null - needed for
  // chatRetentionDays where null = "retain forever" is a real choice.
  const update = { updatedAt: new Date() };
  if ("goals" in body) update.goals = body.goals ?? row.goals;
  if ("restrictions" in body) update.restrictions = body.restrictions ?? row.restrictions;
  if ("preferences" in body) update.preferences = body.preferences ?? row.preferences;
  if ("chatRetentionDays" in body) {
    const v = body.chatRetentionDays;
    update.chatRetentionDays = v == null || Number(v) <= 0 ? null : Number(v);
  }
  if ("waterTargetMl" in body) {
    const v = body.waterTargetMl;
    update.waterTargetMl = v == null || Number(v) <= 0 ? null : Math.round(Number(v));
  }
  if ("waterContainers" in body) {
    update.waterContainers = body.waterContainers == null ? null : normaliseContainers(body.waterContainers);
  }
  if ("miniExercises" in body) {
    update.miniExercises = body.miniExercises == null ? null : normaliseMiniExercises(body.miniExercises);
  }
  if ("personality" in body) {
    // Coerce anything unknown to the default to avoid storing junk.
    // body.personality === null is a valid "reset to default" signal -
    // store NULL in the DB and let lib/personality.js resolve to 'steady'.
    update.personality =
      body.personality == null ? null : normalisePersonality(body.personality);
  }
  const [updated] = await db
    .update(USER_CONTEXT)
    .set(update)
    .where(and(familyFilter(USER_CONTEXT, familyId), eq(USER_CONTEXT.id, row.id), eq(USER_CONTEXT.userId, userId)))
    .returning();
  return NextResponse.json(updated);
});
