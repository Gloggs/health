// My appointment: the person's next GP appointment, their 2 or 3 questions and their medicines (NHS advice).
// One per person, private always: filtered to the signed-in person, never shared with family.
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { APPOINTMENTS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const GET = withFamily(async (_req, _ctx, { viewerId, isViewingOther, familyId }) => {
  if (isViewingOther) return NextResponse.json(null);
  const [row] = await db.select().from(APPOINTMENTS)
    .where(and(familyFilter(APPOINTMENTS, familyId), eq(APPOINTMENTS.userId, viewerId))).limit(1);
  return NextResponse.json(row ?? null);
});

export const PUT = withFamilyWrite(async (req, _ctx, { viewerId, familyId }) => {
  const body = await req.json();
  const date = body?.date ? String(body.date) : null;
  if (date && !ISO.test(date)) return NextResponse.json({ error: "Please choose a date." }, { status: 400 });
  const values = {
    date,
    questions: clampString(body?.questions, "questions", 1500) || null,
    medicines: clampString(body?.medicines, "medicines", 1500) || null,
    updatedAt: new Date(),
  };
  const [row] = await db.insert(APPOINTMENTS).values({ ...values, userId: viewerId, familyId })
    .onConflictDoUpdate({ target: [APPOINTMENTS.familyId, APPOINTMENTS.userId], set: values }).returning();
  return NextResponse.json(row);
});
