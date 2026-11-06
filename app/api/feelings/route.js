// How I feel: the person's own record of what is going on, to show a GP. Private to them, always:
// every query is filtered to the signed-in person (never ?viewing=), and nothing here is ever shared.
import { NextResponse } from "next/server";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { FEELINGS } from "@/utils/schema";
import { withFamily, withFamilyWrite, familyFilter } from "@/lib/auth";
import { clampString } from "@/lib/validate";

export const dynamic = "force-dynamic";

// The person's own words for how bad it is. The app never turns these into a score.
const HOW_BAD = ["mild", "moderate", "bad"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function clean(body) {
  const what = clampString(body?.what, "what", 80);
  if (!what) {
    const e = new Error("Please say what is going on, in a few words."); e.status = 400; throw e;
  }
  if (!ISO.test(String(body?.date ?? ""))) {
    const e = new Error("Please choose a date."); e.status = 400; throw e;
  }
  const howBad = body?.howBad == null || body.howBad === "" ? null : String(body.howBad);
  if (howBad !== null && !HOW_BAD.includes(howBad)) {
    const e = new Error("How bad must be mild, moderate or bad."); e.status = 400; throw e;
  }
  return {
    date: body.date,
    what,
    whereOnBody: clampString(body?.whereOnBody, "whereOnBody", 60) || null,
    howBad,
    better: clampString(body?.better, "better") || null,
    worse: clampString(body?.worse, "worse") || null,
    note: clampString(body?.note, "note") || null,
  };
}

export const GET = withFamily(async (req, _ctx, { viewerId, isViewingOther, familyId }) => {
  if (isViewingOther) return NextResponse.json([]); // never shared, not even with family
  const sp = req.nextUrl.searchParams;
  const filters = [familyFilter(FEELINGS, familyId), eq(FEELINGS.userId, viewerId)];
  if (ISO.test(sp.get("from") ?? "")) filters.push(gte(FEELINGS.date, sp.get("from")));
  if (ISO.test(sp.get("to") ?? "")) filters.push(lte(FEELINGS.date, sp.get("to")));
  const rows = await db.select().from(FEELINGS).where(and(...filters)).orderBy(desc(FEELINGS.date), desc(FEELINGS.createdAt));
  return NextResponse.json(rows);
});

export const POST = withFamilyWrite(async (req, _ctx, { viewerId, familyId }) => {
  const values = clean(await req.json());
  const [row] = await db.insert(FEELINGS).values({ ...values, userId: viewerId, familyId }).returning();
  return NextResponse.json(row, { status: 201 });
});

export const PUT = withFamilyWrite(async (req, _ctx, { viewerId, familyId }) => {
  const body = await req.json();
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const values = clean(body);
  const [row] = await db.update(FEELINGS).set({ ...values, updatedAt: new Date() })
    .where(and(familyFilter(FEELINGS, familyId), eq(FEELINGS.userId, viewerId), eq(FEELINGS.id, id))).returning();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(row);
});

export const DELETE = withFamilyWrite(async (req, _ctx, { viewerId, familyId }) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const [row] = await db.delete(FEELINGS)
    .where(and(familyFilter(FEELINGS, familyId), eq(FEELINGS.userId, viewerId), eq(FEELINGS.id, id))).returning({ id: FEELINGS.id });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
});
