/**
 * Server-side auth helpers for the family-tenant API surface.
 *
 * Every API route that touches user data should go through one of these so
 * that the "filter by current user" step is structurally impossible to
 * forget. Middleware already gates /dashboard pages; these helpers gate the
 * /api routes that those pages call.
 *
 * Viewing-mode (Phase 2 Stage 2):
 *   - A request can carry `?viewing=<otherUserId>` in the URL.
 *   - `requireFamilyUser(req)` resolves this into a stable shape:
 *       { viewerId, viewingId, isViewingOther, vieweeVisibility, familyId }
 *   - `viewerId` is always the signed-in person. WRITES must use this.
 *   - `viewingId` is who the request wants to READ - defaults to viewerId.
 *   - `isViewingOther` is true only when viewing= names a different family
 *     member who actually exists in USERS and shares a family with the
 *     viewer. Unknown ids silently clamp
 *     back to the viewer (no error - keeps the URL forgiving).
 *   - `vieweeVisibility` is the viewee's effective visibility flags so a
 *     read handler can blank hidden sections without re-querying USERS.
 *   - `familyId` is the viewer's primary family (resolved via MEMBERSHIPS).
 *     Used by
 *     route handlers via `familyFilter()` below to scope every query.
 *   - `userId` is preserved as an alias for `viewerId` so existing route
 *     handlers that destructure `{ userId }` keep working untouched.
 *
 * Tenant isolation:
 *   The viewer's family is always resolved via MEMBERSHIPS and every health
 *   query filters by family_id through `familyFilter()`.
 */

import { NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { USERS, MEMBERSHIPS } from "@/utils/schema";
import { effectiveVisibility } from "@/lib/visibility";


/**
 * Returns the Drizzle condition `eq(table.familyId, familyId)`. Every query
 * on a health table must include it, alongside the user filter:
 *
 *   .where(and(
 *     familyFilter(SLEEP_LOGS, familyId),
 *     eq(SLEEP_LOGS.userId, userId),
 *     eq(SLEEP_LOGS.date, date)
 *   ))
 *
 * Throws 503 if no familyId was passed, which means requireFamilyUser could
 * not resolve a membership.
 */
export function familyFilter(table, familyId) {
  // Always on. This used to be gated by WORKSPACE_ABSTRACTION_ENABLED, which
  // meant a missing Vercel setting turned off tenant isolation (the family
  // chat feed, for one, then returned every family's messages). family_id is
  // NOT NULL on every health table and requireFamilyUser always resolves it,
  // so there is no reason left to make this optional.
  if (!familyId) {
    const err = new Error("cannot resolve family for current user");
    err.status = 503;
    throw err;
  }
  return eq(table.familyId, familyId);
}

/**
 * Returns the Kinde-authenticated user, or null if unauthenticated.
 * Doesn't enforce family membership - use requireFamilyUser for that.
 */
export async function getKindeUser() {
  const session = getKindeServerSession();
  if (!(await session.isAuthenticated())) return null;
  return session.getUser();
}

/**
 * The full identity check used by every API route.
 *
 * Returns `{ user, userId, viewerId, viewingId, isViewingOther,
 * vieweeVisibility, familyId, email, isFamilyMember }` or throws an Error
 * with an HTTP status code set on it (.status). Route handlers can:
 *
 *   try {
 *     const { viewerId, viewingId } = await requireFamilyUser(req);
 *     // ... do work ...
 *   } catch (e) {
 *     return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
 *   }
 *
 * `req` is optional. When omitted (or when the request has no `?viewing=`
 * param) viewing mode is off: `viewingId === viewerId`, `isViewingOther` is
 * false, `vieweeVisibility` is null. The withFamily / withFamilyWrite
 * wrappers always pass req along so handlers don't need to think about it.
 *
 * The allow-list comes from FAMILY_EMAILS (preferred) or the legacy
 * ALLOWED_EMAILS env var (kept for backwards compat with the single-user
 * deployment). When BOTH are unset, the gate is open - matches the
 * pre-migration behaviour and lets local dev work without env wrangling.
 */
export async function requireFamilyUser(req) {
  const user = await getKindeUser();
  if (!user) {
    const err = new Error("not authenticated");
    err.status = 401;
    throw err;
  }

  const email = (user.email ?? "").toLowerCase();

  // Phase D.7 (2026-05-22): the email allow-list (FAMILY_EMAILS /
  // ALLOWED_EMAILS) is no longer consulted here. MEMBERSHIPS is the
  // single source of truth for "is this user allowed into the API?".
  //
  // The middleware still references the legacy env vars as a fallback
  // gate so existing-but-not-yet-signed-in family members aren't
  // accidentally locked out mid-rollout. Once every family member has
  // accepted an invite, the env vars can be removed from Vercel and the
  // middleware fallback fades to nothing.

  const viewerId = user.id;
  let viewingId = viewerId;
  let isViewingOther = false;
  let vieweeVisibility = null;
  let viewerFamilyId = null;

  // Heartbeat: bump lastActiveAt on every authed call - but DEBOUNCED so
  // we don't write to Neon every 1.5s during active chat polling. Read
  // the existing timestamp first; only update if it's older than the
  // threshold. Active users (polling fast) hit the SELECT-only branch
  // ~95% of the time. Documented threshold matches "fresh enough that
  // the Family page's 'last seen' text doesn't visibly lag."
  const HEARTBEAT_DEBOUNCE_MS = 30_000;
  let viewerLastActiveRaw = null;
  try {
    const [existing] = await db
      .select({ lastActiveAt: USERS.lastActiveAt })
      .from(USERS)
      .where(eq(USERS.id, viewerId))
      .limit(1);
    viewerLastActiveRaw = existing?.lastActiveAt ?? null;
    const last = viewerLastActiveRaw ? new Date(viewerLastActiveRaw).getTime() : 0;
    if (Date.now() - last > HEARTBEAT_DEBOUNCE_MS) {
      await db
        .update(USERS)
        .set({ lastActiveAt: new Date() })
        .where(eq(USERS.id, viewerId));
    }
  } catch {
    // The USERS row may not exist yet (very first call before
    // ensureUserRow lazy-creates it). Swallow - the next call will
    // succeed once the row is in place.
  }

  // F1: resolve the viewer's primary family via MEMBERSHIPS on every
  // request. Most-recently-joined wins for the multi-family future;
  // v1 should always have exactly one. The resolution happens
  // UNCONDITIONALLY (not gated by the feature flag) because:
  //   - The family_id column is NOT NULL on every health table after B.2
  //   - INSERTs must include a non-null family_id even before we flip
  //     the read-side feature flag
  //   - Without this, every write would fail with a constraint violation
  //
  const [m] = await db
    .select({ familyId: MEMBERSHIPS.familyId })
    .from(MEMBERSHIPS)
    .where(eq(MEMBERSHIPS.userId, viewerId))
    .orderBy(desc(MEMBERSHIPS.joinedAt))
    .limit(1);
  viewerFamilyId = m?.familyId ?? null;
  if (!viewerFamilyId) {
    console.error(
      `[auth] user ${viewerId} (${email}) has no MEMBERSHIPS row - cannot resolve family`
    );
    const err = new Error("user has no family membership");
    err.status = 503;
    throw err;
  }

  // Parse ?viewing= only when a Request-like object was passed. The lookup
  // skips when viewing=self (no point) and silently clamps back to the
  // viewer when the id is unknown OR when the viewee isn't authorised to
  // be viewed by this viewer.
  //
  // Authorisation rule (Phase D.7): viewee must share a family with the
  // viewer (have a MEMBERSHIPS row pointing at viewerFamilyId). The
  // legacy "viewee must be in email allow-list" branch was removed when
  // MEMBERSHIPS became the access-control truth.
  const viewingParam = req?.nextUrl?.searchParams?.get?.("viewing");
  if (viewingParam && viewingParam !== viewerId) {
    const [viewee] = await db
      .select({
        id: USERS.id,
        email: USERS.email,
        visibility: USERS.visibility,
      })
      .from(USERS)
      .where(eq(USERS.id, viewingParam))
      .limit(1);

    let vieweeAllowed = false;
    if (viewee && viewerFamilyId) {
      const [sharedMembership] = await db
        .select({ userId: MEMBERSHIPS.userId })
        .from(MEMBERSHIPS)
        .where(
          and(
            eq(MEMBERSHIPS.userId, viewingParam),
            eq(MEMBERSHIPS.familyId, viewerFamilyId)
          )
        )
        .limit(1);
      vieweeAllowed = !!sharedMembership;
    }

    if (vieweeAllowed && viewee) {
      viewingId = viewee.id;
      isViewingOther = true;
      vieweeVisibility = effectiveVisibility(viewee.visibility);
    }
  }

  return {
    user,
    userId: viewerId, // legacy alias - handlers that destructure { userId } keep working
    viewerId,
    viewingId,
    isViewingOther,
    vieweeVisibility,
    familyId: viewerFamilyId,
    email,
    isFamilyMember: true,
  };
}

/**
 * Looser auth gate for endpoints that run BEFORE the user has a family
 * membership — onboarding's "create family" POST, the public invite
 * validate endpoint, and invite-accept. Returns `{ user, userId, email,
 * hasFamily, familyId }` without throwing on missing membership.
 *
 * Still requires a valid Kinde session and ensures the USERS row exists.
 * `hasFamily` lets the caller branch ("already in a family — go to
 * dashboard" vs "no family yet — proceed with create or accept").
 *
 * In production, also requires the user's email to be verified by Kinde
 * — prevents someone from claiming an invite for somebody else's address
 * via Kinde's "sign in with email" flow before they've proven they own
 * that mailbox.
 */
export async function requireKindeOnly() {
  const user = await getKindeUser();
  if (!user) {
    const err = new Error("not authenticated");
    err.status = 401;
    throw err;
  }
  const email = (user.email ?? "").toLowerCase();
  await ensureUserRow(user.id, email);

  const [m] = await db
    .select({ familyId: MEMBERSHIPS.familyId })
    .from(MEMBERSHIPS)
    .where(eq(MEMBERSHIPS.userId, user.id))
    .orderBy(desc(MEMBERSHIPS.joinedAt))
    .limit(1);

  return {
    user,
    userId: user.id,
    email,
    hasFamily: !!m?.familyId,
    familyId: m?.familyId ?? null,
  };
}

/**
 * Look up the family member's USERS row, creating it lazily on first call
 * if missing. Used by onboarding + the claim flow.
 *
 * F1 note: this does NOT create a MEMBERSHIPS row. New signups will need
 * one created via the invite flow (Phase D) or as part of "create your
 * family" first-run. Until that's wired, ensureUserRow + a missing
 * membership will surface as a 503 from requireFamilyUser.
 */
export async function ensureUserRow(userId, email) {
  const [existing] = await db.select().from(USERS).where(eq(USERS.id, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(USERS)
    .values({
      id: userId,
      email,
      displayName: null,
      visibility: null, // null = default-all-visible
    })
    .returning();
  return created;
}

/**
 * Route-handler wrapper that runs requireFamilyUser before the handler
 * and turns thrown auth errors into the right NextResponse.
 *
 * Usage:
 *   export const GET = withFamily(async (req, _ctx, { viewingId, familyId }) => {
 *     // read viewingId so the response reflects ?viewing= when present
 *     // pass familyId to familyFilter() in every health-table query
 *   });
 *
 * The third argument (auth) carries the full identity envelope including
 * viewing-mode fields. Handlers must always include `viewerId` in inserts
 * and a `userId`/`viewerId` filter in deletes - the wrapper enforces auth
 * but cannot stop a handler from running a query that ignores the user.
 * Code review is the second line of defence.
 *
 * For mutating handlers, prefer `withFamilyWrite` - it adds a hard 403 when
 * the request is in viewing-other mode so a sibling can't write to your
 * data even if a stray client somehow posted with `?viewing=` set.
 */
export function withFamily(handler) {
  return async (req, ctx) => {
    let auth;
    try {
      auth = await requireFamilyUser(req);
    } catch (e) {
      return NextResponse.json(
        { error: e.message ?? "unauthorized" },
        { status: e.status ?? 500 }
      );
    }
    // Catch errors thrown by the handler body too. Validation helpers
    // (lib/validate.js) attach .status to thrown errors; we map those to
    // the right HTTP status. Anything without a recognisable .status
    // becomes a generic 500 and is logged so it shows up in Vercel.
    try {
      return await handler(req, ctx, auth);
    } catch (e) {
      if (e?.status && Number.isInteger(e.status) && e.status >= 400 && e.status < 600) {
        return NextResponse.json(
          { error: e.message ?? "error" },
          { status: e.status }
        );
      }
      console.error("[withFamily] unexpected handler error:", e);
      return NextResponse.json(
        { error: "internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Same as `withFamily`, plus a hard 403 when the request carries
 * `?viewing=<otherUserId>`. Use for POST / PUT / DELETE handlers so that
 * the read-only "viewing Mum" mode can never mutate anyone's data, even
 * if a UI button slips through without the conditional render.
 *
 * Returns the 403 BEFORE the handler runs - no work is done.
 */
export function withFamilyWrite(handler) {
  return withFamily(async (req, ctx, auth) => {
    if (auth.isViewingOther) {
      return NextResponse.json(
        { error: "read-only while viewing another family member" },
        { status: 403 }
      );
    }
    return handler(req, ctx, auth);
  });
}
