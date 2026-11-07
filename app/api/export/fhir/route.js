// The person's own entries as a FHIR R4 Bundle (lib/fhir.js), as a file to download. Only ever the signed-in
// person's own data; health sends it nowhere.
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { FEELINGS, SLEEP_LOGS, BODY_METRICS, MOOD_LOGS, APPOINTMENTS, USERS } from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";
import { buildFhirBundle } from "@/lib/fhir";

export const dynamic = "force-dynamic";

export const GET = withFamily(async (_req, _ctx, { viewerId, isViewingOther, familyId }) => {
  if (isViewingOther) return NextResponse.json({ error: "An export is only for the person whose data it is." }, { status: 403 });
  const mine = (t) => and(familyFilter(t, familyId), eq(t.userId, viewerId));
  const [feelings, sleep, body, mood, [appointment], [me]] = await Promise.all([
    db.select().from(FEELINGS).where(mine(FEELINGS)),
    db.select().from(SLEEP_LOGS).where(mine(SLEEP_LOGS)),
    db.select().from(BODY_METRICS).where(mine(BODY_METRICS)),
    db.select().from(MOOD_LOGS).where(mine(MOOD_LOGS)),
    db.select().from(APPOINTMENTS).where(mine(APPOINTMENTS)).limit(1),
    db.select({ displayName: USERS.displayName }).from(USERS).where(eq(USERS.id, viewerId)).limit(1),
  ]);
  const bundle = buildFhirBundle({ name: me?.displayName ?? null, generatedAt: new Date().toISOString(), feelings, sleep, body, mood, appointment });
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: { "Content-Type": "application/fhir+json", "Content-Disposition": 'attachment; filename="health-fhir-export.json"', "Cache-Control": "no-store" },
  });
});
