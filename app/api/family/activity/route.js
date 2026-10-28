import { NextResponse } from "next/server";
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import {
  USERS,
  MEMBERSHIPS,
  SLEEP_LOGS,
  MOOD_LOGS,
  CARDIO_LOGS,
  BODY_METRICS,
  MEAL_LOGS,
  DAILY_MINI_LOGS,
  SESSIONS,
  PLAN_DAYS,
} from "@/utils/schema";
import { withFamily, familyFilter } from "@/lib/auth";
import { daysAgoStr } from "@/lib/dates";
import { effectiveVisibility } from "@/lib/visibility";

export const dynamic = "force-dynamic";

// GET /api/family/activity?limit=30&days=14
// Unified, visibility-filtered feed of recent activity across every
// family member. Powers the "Dad walked 30 min · today" stream below
// the family tile grid.
//
// Family scoping: the USERS list is joined with MEMBERSHIPS so only
// users belonging to the viewer's family appear in `ids` - even with
// the workspace flag off, that single-family-only filter is correct.
// Each health-table SELECT additionally uses familyFilter (no-op when
// flag is off; cross-tenant safety when on).
export const GET = withFamily(async (req, _ctx, { viewerId, familyId }) => {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));
  const days = Math.min(60, Math.max(1, Number(sp.get("days")) || 14));
  const since = daysAgoStr(days);

  // Roster + visibility, scoped to viewer's family via MEMBERSHIPS join.
  const members = await db
    .select({
      id: USERS.id,
      displayName: USERS.displayName,
      visibility: USERS.visibility,
    })
    .from(USERS)
    .innerJoin(MEMBERSHIPS, eq(MEMBERSHIPS.userId, USERS.id))
    .where(eq(MEMBERSHIPS.familyId, familyId));
  if (members.length === 0) {
    return NextResponse.json({ items: [] });
  }
  const visById = new Map(
    members.map((m) => [m.id, effectiveVisibility(m.visibility)])
  );
  const nameById = new Map(members.map((m) => [m.id, m.displayName || "Someone"]));
  const ids = members.map((m) => m.id);

  // Pull each source. Server-side WHERE on family_id + user_id + date keeps
  // the payload bounded even for accounts with years of history.
  const [
    sleepRows,
    moodRows,
    cardioRows,
    bodyRows,
    mealRows,
    miniRows,
    sessionRows,
  ] = await Promise.all([
    db
      .select({
        userId: SLEEP_LOGS.userId,
        date: SLEEP_LOGS.date,
        createdAt: SLEEP_LOGS.createdAt,
        hours: SLEEP_LOGS.hours,
        quality: SLEEP_LOGS.quality,
      })
      .from(SLEEP_LOGS)
      .where(and(familyFilter(SLEEP_LOGS, familyId), inArray(SLEEP_LOGS.userId, ids), gte(SLEEP_LOGS.date, since))),
    db
      .select({
        userId: MOOD_LOGS.userId,
        date: MOOD_LOGS.date,
        createdAt: MOOD_LOGS.createdAt,
        mood: MOOD_LOGS.mood,
        energy: MOOD_LOGS.energy,
      })
      .from(MOOD_LOGS)
      .where(and(familyFilter(MOOD_LOGS, familyId), inArray(MOOD_LOGS.userId, ids), gte(MOOD_LOGS.date, since))),
    db
      .select({
        userId: CARDIO_LOGS.userId,
        date: CARDIO_LOGS.date,
        createdAt: CARDIO_LOGS.createdAt,
        type: CARDIO_LOGS.type,
        durationMinutes: CARDIO_LOGS.durationMinutes,
        distanceKm: CARDIO_LOGS.distanceKm,
      })
      .from(CARDIO_LOGS)
      .where(and(familyFilter(CARDIO_LOGS, familyId), inArray(CARDIO_LOGS.userId, ids), gte(CARDIO_LOGS.date, since))),
    db
      .select({
        userId: BODY_METRICS.userId,
        date: BODY_METRICS.date,
        createdAt: BODY_METRICS.createdAt,
        weightKg: BODY_METRICS.weightKg,
      })
      .from(BODY_METRICS)
      .where(
        and(
          familyFilter(BODY_METRICS, familyId),
          inArray(BODY_METRICS.userId, ids),
          gte(BODY_METRICS.date, since),
          isNotNull(BODY_METRICS.weightKg)
        )
      ),
    db
      .select({
        userId: MEAL_LOGS.userId,
        date: MEAL_LOGS.date,
        createdAt: MEAL_LOGS.createdAt,
        slot: MEAL_LOGS.slot,
        description: MEAL_LOGS.description,
        quality: MEAL_LOGS.quality,
      })
      .from(MEAL_LOGS)
      .where(and(familyFilter(MEAL_LOGS, familyId), inArray(MEAL_LOGS.userId, ids), gte(MEAL_LOGS.date, since))),
    db
      .select({
        userId: DAILY_MINI_LOGS.userId,
        date: DAILY_MINI_LOGS.date,
        updatedAt: DAILY_MINI_LOGS.updatedAt,
        slot: DAILY_MINI_LOGS.slot,
        count: DAILY_MINI_LOGS.count,
      })
      .from(DAILY_MINI_LOGS)
      .where(and(familyFilter(DAILY_MINI_LOGS, familyId), inArray(DAILY_MINI_LOGS.userId, ids), gte(DAILY_MINI_LOGS.date, since))),
    db
      .select({
        userId: SESSIONS.userId,
        date: SESSIONS.date,
        createdAt: SESSIONS.createdAt,
        completed: SESSIONS.completed,
        planDayLabel: PLAN_DAYS.label,
      })
      .from(SESSIONS)
      .leftJoin(PLAN_DAYS, eq(PLAN_DAYS.id, SESSIONS.planDayId))
      .where(
        and(
          familyFilter(SESSIONS, familyId),
          inArray(SESSIONS.userId, ids),
          gte(SESSIONS.date, since),
          eq(SESSIONS.completed, true)
        )
      ),
  ]);

  // Build a single item array, applying the per-user visibility filter as
  // we go. Items not visible to the viewer are simply omitted; we don't
  // emit "private" placeholders here because the feed is a stream of
  // *events* - the absence of one event isn't itself information worth
  // surfacing (unlike the dashboard's structured sections).
  const items = [];
  const visibleFor = (uid, flag) => uid === viewerId || visById.get(uid)?.[flag];
  const push = (item) => {
    if (!item.summary) return;
    items.push(item);
  };

  // Voice rules (SURFACES.md §3): "etched X" is the verb across every
  // category — same word the user pressed when they made the entry.
  // No "logged", no "completed", no "rated" — those break the spell.
  for (const r of sleepRows) {
    if (!visibleFor(r.userId, "sleep")) continue;
    push({
      kind: "sleep",
      userId: r.userId,
      userName: nameById.get(r.userId),
      date: r.date,
      ts: r.createdAt,
      summary:
        r.hours != null
          ? `etched sleep · ${Number(r.hours)}h${r.quality ? ` · ${r.quality}/5` : ""}`
          : `etched sleep`,
    });
  }
  for (const r of moodRows) {
    if (!visibleFor(r.userId, "mood")) continue;
    if (!r.mood && !r.energy) continue;
    const parts = [];
    if (r.mood) parts.push(`mood ${r.mood}/5`);
    if (r.energy) parts.push(`energy ${r.energy}/5`);
    push({
      kind: "mood",
      userId: r.userId,
      userName: nameById.get(r.userId),
      date: r.date,
      ts: r.createdAt,
      summary: `etched ${parts.join(" · ")}`,
    });
  }
  for (const r of cardioRows) {
    if (!visibleFor(r.userId, "cardio")) continue;
    const type = (r.type || "cardio").toLowerCase();
    const mins = r.durationMinutes;
    const dist = r.distanceKm == null ? null : Number(r.distanceKm);
    let body = null;
    if (mins && dist) body = `${mins} min ${type} · ${dist}km`;
    else if (mins) body = `${mins} min ${type}`;
    else if (dist) body = `${dist}km ${type}`;
    push({
      kind: "cardio",
      userId: r.userId,
      userName: nameById.get(r.userId),
      date: r.date,
      ts: r.createdAt,
      summary: body ? `etched ${body}` : null,
    });
  }
  for (const r of bodyRows) {
    if (!visibleFor(r.userId, "body")) continue;
    push({
      kind: "body",
      userId: r.userId,
      userName: nameById.get(r.userId),
      date: r.date,
      ts: r.createdAt,
      summary: `etched a weigh-in · ${Number(r.weightKg).toFixed(1)}kg`,
    });
  }
  for (const r of mealRows) {
    if (!visibleFor(r.userId, "meals")) continue;
    const slot = (r.slot || "meal").toLowerCase();
    const qualityNote =
      r.quality === 1 ? " · junk" : r.quality === 3 ? " · healthy" : "";
    push({
      kind: "meals",
      userId: r.userId,
      userName: nameById.get(r.userId),
      date: r.date,
      ts: r.createdAt,
      summary: `etched ${slot}${qualityNote}`,
    });
  }
  for (const r of miniRows) {
    // Daily 4 is always-visible (it's header data, no toggle). Skip slots
    // that ended up at 0 - same rule the streak uses.
    if (!(Number(r.count) > 0)) continue;
    push({
      kind: "mini",
      userId: r.userId,
      userName: nameById.get(r.userId),
      date: r.date,
      ts: r.updatedAt,
      summary: `etched Daily 4 · ${r.count} reps`,
    });
  }
  for (const r of sessionRows) {
    if (!visibleFor(r.userId, "workouts")) continue;
    if (!r.completed) continue;
    push({
      kind: "session",
      userId: r.userId,
      userName: nameById.get(r.userId),
      date: r.date,
      ts: r.createdAt,
      summary: `etched ${r.planDayLabel || "a session"}`,
    });
  }

  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const at = a.ts ? new Date(a.ts).getTime() : 0;
    const bt = b.ts ? new Date(b.ts).getTime() : 0;
    return bt - at;
  });

  return NextResponse.json({ items: items.slice(0, limit) });
});
