import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { USERS } from "@/utils/schema";
import { withFamily, requireKindeOnly, ensureUserRow } from "@/lib/auth";
import { effectiveVisibility, normaliseVisibility } from "@/lib/visibility";
import { computeAge, maxAllowedDob, minAllowedDob } from "@/lib/age";

export const dynamic = "force-dynamic";

// Wraps a USERS row with a computed `age` field so the UI doesn't have to
// re-implement the date math in three places (profile card, Family list,
// weekly summary). DOB stays the source of truth in the DB.
function decorate(row) {
  if (!row) return row;
  return { ...row, age: computeAge(row.dateOfBirth) };
}

// GET /api/users/me - own profile by default. When ?viewing=<otherId> is
// set, returns the viewee's profile instead, with age/height blanked when
// their visibility flags hide them. This is the data source the ViewingBanner
// uses to render "Viewing Mum · Back to my view" without needing a second
// roster fetch.
//
// `lastActiveAt` is bumped on every self-view (heartbeat). NOT bumped on
// viewing-other - the viewee shouldn't appear "active" just because someone
// else looked at their tile.
//
// The self-view branch uses `requireKindeOnly` (no membership required) so
// the onboarding wizard can load /api/users/me before the user has a
// family. The viewing-other branch uses `withFamily` (full guard) because
// it leaks data across users and needs the family-membership check.
export async function GET(req) {
  const url = new URL(req.url);
  const viewing = url.searchParams.get("viewing");

  if (!viewing) {
    // Self-view: only requires Kinde auth. Onboarding hits this before the
    // user has created a family.
    let auth;
    try {
      auth = await requireKindeOnly();
    } catch (e) {
      return NextResponse.json(
        { error: e.message },
        { status: e.status ?? 500 }
      );
    }
    const existing = await ensureUserRow(auth.userId, auth.email);
    await db
      .update(USERS)
      .set({ lastActiveAt: new Date() })
      .where(eq(USERS.id, auth.userId));
    return NextResponse.json({
      ...decorate(existing),
      isViewingOther: false,
      hasFamily: auth.hasFamily,
      familyId: auth.familyId,
      lastActiveAt: new Date().toISOString(),
    });
  }

  // Viewing-other branch: full family auth required (this leaks viewee data
  // across users, so it needs the membership + viewing-permission check).
  return withFamily(async (_req, _ctx, auth) => {
    const { viewingId, vieweeVisibility } = auth;
    const [viewee] = await db
      .select()
      .from(USERS)
      .where(eq(USERS.id, viewingId))
      .limit(1);
    if (!viewee) {
      return NextResponse.json({ error: "viewee not found" }, { status: 404 });
    }
    const vis = vieweeVisibility ?? effectiveVisibility(viewee.visibility);
    return NextResponse.json({
      id: viewee.id,
      displayName: viewee.displayName,
      dateOfBirth: vis.age ? viewee.dateOfBirth : null,
      age: vis.age ? computeAge(viewee.dateOfBirth) : null,
      heightCm: vis.height
        ? viewee.heightCm == null
          ? null
          : Number(viewee.heightCm)
        : null,
      visibility: vis,
      lastActiveAt: viewee.lastActiveAt,
      email: null,
      isViewingOther: true,
    });
  })(req);
}

// PUT /api/users/me - partial update of own profile.
// Used by onboarding (per-step partial saves; allows cross-device sync) and
// the Settings > Privacy tab. Uses `requireKindeOnly` so users can fill in
// their name/DOB/visibility BEFORE creating a family (the wizard flow puts
// family creation either before or after the profile steps).
export async function PUT(req) {
  let auth;
  try {
    auth = await requireKindeOnly();
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
  const { userId, email } = auth;
  await ensureUserRow(userId, email);
  const body = await req.json();

  const update = { lastActiveAt: new Date() };

  if ("displayName" in body) {
    const name = String(body.displayName ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "displayName cannot be empty" }, { status: 400 });
    }
    update.displayName = name.slice(0, 60);
  }

  if ("dateOfBirth" in body) {
    const v = body.dateOfBirth;
    if (v == null || v === "") {
      update.dateOfBirth = null;
    } else {
      const s = String(v);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return NextResponse.json(
          { error: "dateOfBirth must be YYYY-MM-DD" },
          { status: 400 }
        );
      }
      // Bound the value to "plausibly human": at least 1 year old, at most
      // 130. Stops typos like 2089 from corrupting the row.
      if (s < minAllowedDob() || s > maxAllowedDob()) {
        return NextResponse.json(
          { error: "dateOfBirth must be between 1 and 130 years ago" },
          { status: 400 }
        );
      }
      update.dateOfBirth = s;
    }
  }

  if ("heightCm" in body) {
    const v = body.heightCm;
    if (v == null || v === "") {
      update.heightCm = null;
    } else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 50 || n > 250) {
        return NextResponse.json({ error: "heightCm must be 50-250" }, { status: 400 });
      }
      update.heightCm = String(n);
    }
  }

  if ("visibility" in body) {
    update.visibility = body.visibility == null ? null : normaliseVisibility(body.visibility);
  }

  const [row] = await db
    .update(USERS)
    .set(update)
    .where(eq(USERS.id, userId))
    .returning();
  return NextResponse.json(decorate(row));
}
