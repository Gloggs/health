import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { REMINDERS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

export const dynamic = "force-dynamic";

export const GET = withFamily(async (_req, _ctx, { userId, familyId }) => {
  const rows = await db
    .select()
    .from(REMINDERS)
    .where(and(familyFilter(REMINDERS, familyId), eq(REMINDERS.userId, userId)))
    .orderBy(desc(REMINDERS.createdAt));
  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  const label = clampString(body.label, "label");
  if (!body.kind || !label) {
    return NextResponse.json({ error: "kind and label are required" }, { status: 400 });
  }
  const [row] = await db
    .insert(REMINDERS)
    .values({
      userId,
      familyId,
      kind: body.kind,
      label,
      schedule: clampString(body.schedule, "label", 80),
      channel: body.channel ?? "push",
      enabled: body.enabled ?? true,
      quietOnRest: body.quietOnRest ?? false,
    })
    .returning();
  return NextResponse.json(row);
});

// Partial update so a toggle from the list doesn't clobber the label/schedule.
export const PUT = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const update = {};
  if ("kind" in body) update.kind = body.kind;
  if ("label" in body) update.label = clampString(body.label, "label");
  if ("schedule" in body) update.schedule = clampString(body.schedule, "label", 80);
  if ("channel" in body) update.channel = body.channel ?? "push";
  if ("enabled" in body) update.enabled = !!body.enabled;
  if ("quietOnRest" in body) update.quietOnRest = !!body.quietOnRest;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }
  const [row] = await db
    .update(REMINDERS)
    .set(update)
    .where(and(familyFilter(REMINDERS, familyId), eq(REMINDERS.id, body.id), eq(REMINDERS.userId, userId)))
    .returning();
  return NextResponse.json(row ?? null);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { userId, familyId }) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db
    .delete(REMINDERS)
    .where(and(familyFilter(REMINDERS, familyId), eq(REMINDERS.id, Number(id)), eq(REMINDERS.userId, userId)));
  return NextResponse.json({ success: true });
});
