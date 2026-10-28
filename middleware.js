import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { USERS, MEMBERSHIPS } from "@/utils/schema";

// Family-tenant gate for every /dashboard route + /onboarding.
//
// Two layers of access control after the Kinde auth check:
//   1. Email allow-list (LEGACY): FAMILY_EMAILS / ALLOWED_EMAILS env vars.
//      Pre-Phase-D the only way to get in. Kept during the transition so
//      the founder's existing family doesn't get locked out mid-rollout.
//      Will be removed entirely in Phase D.7 once invites are live and
//      everyone in the original family has a MEMBERSHIPS row.
//   2. MEMBERSHIPS row (NEW): any user who has an active membership is
//      allowed in regardless of allow-list. This is the path invited
//      users take — they accept an invite token at /join/<token>, that
//      creates a MEMBERSHIPS row, and from there on they pass the gate
//      without ever being on the email allow-list.
//
// Either layer is sufficient. Both empty in production = fail closed.
const FAMILY_EMAILS = (process.env.FAMILY_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const ALLOW_SET = new Set([...FAMILY_EMAILS, ...ALLOWED_EMAILS]);

// Public wrapper: catches ANY exception thrown by the gate logic and
// redirects to a safe recovery surface instead of letting Vercel show its
// raw `MIDDLEWARE_INVOCATION_FAILED` 500.
//
// Common ways the inner middleware can throw:
//   - Kinde's `session.isAuthenticated()` crashes on a malformed / expired
//     cookie (the most common cause — happens when a tab idles past the
//     Kinde session TTL and the user refreshes /dashboard).
//   - Neon serverless driver times out in Vercel Edge runtime (transient
//     cold-start blip).
//   - Module-level import / env var misconfiguration after a fresh deploy.
//
// We bounce to "/" (the marketing landing) because it's the most
// universally-safe surface: unauthed users see the public page, authed
// users can navigate from there. /signed-out would lie ("you've been
// signed out") to a user whose session is still fine.
export async function middleware(request) {
  try {
    return await runMiddleware(request);
  } catch (err) {
    console.error(
      "[middleware] crash:",
      err?.message ?? err,
      "path:",
      request?.nextUrl?.pathname
    );
    const home = new URL("/", request.url);
    // Marker so the home page can optionally surface "your session ended"
    // once we wire that copy in. For now it's just a breadcrumb in URLs
    // that helps spot middleware-crash refreshes in analytics.
    home.searchParams.set("from", "middleware-error");
    return NextResponse.redirect(home);
  }
}

async function runMiddleware(request) {
  const session = getKindeServerSession();

  // Kinde's `isAuthenticated()` can THROW on certain malformed / expired
  // session cookies instead of returning false. Wrap defensively so we
  // treat any thrown-from-auth as "not authenticated" and redirect to
  // login — same outcome as the false branch but reachable without the
  // outer try/catch kicking in.
  let authed = false;
  try {
    authed = await session.isAuthenticated();
  } catch (err) {
    console.warn(
      "[middleware] isAuthenticated threw — treating as logged-out:",
      err?.message ?? err
    );
  }
  if (!authed) {
    const path = request.nextUrl.pathname + (request.nextUrl.search || "");
    return NextResponse.redirect(
      new URL(
        "/api/auth/login?post_login_redirect_url=" + encodeURIComponent(path),
        request.url
      )
    );
  }

  const user = await session.getUser();
  const email = user?.email?.toLowerCase();
  const path = request.nextUrl.pathname;

  // Pull both USERS + MEMBERSHIPS in one round-trip. LEFT JOIN means a
  // user with no membership still returns one row (familyId=null).
  let row;
  try {
    [row] = await db
      .select({
        id: USERS.id,
        displayName: USERS.displayName,
        visibility: USERS.visibility,
        familyId: MEMBERSHIPS.familyId,
      })
      .from(USERS)
      .leftJoin(MEMBERSHIPS, eq(USERS.id, MEMBERSHIPS.userId))
      .where(eq(USERS.id, user.id))
      .limit(1);
  } catch {
    // USERS table doesn't exist yet (fresh deploy before db:push) - let
    // through rather than redirect-loop. The app will surface the real
    // error in the page itself.
    return;
  }

  const hasMembership = !!row?.familyId;
  const onAllowList = !!email && ALLOW_SET.has(email);

  // Access gate: pass when either (a) on the email allow-list OR
  // (b) has an active MEMBERSHIPS row.
  // Fail closed if production has neither configured AND the user has no
  // membership — guards against accidentally dropping env vars.
  if (!hasMembership && !onAllowList) {
    if (process.env.NODE_ENV === "production" && ALLOW_SET.size === 0) {
      // No allow-list configured AT ALL in prod and no membership — this
      // is the "self-serve signup" world. Let the user reach /onboarding
      // to create a family. (In Phase D.7 this becomes the only path.)
      if (path !== "/onboarding") {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
      // Falls through to the onboarding wizard below.
    } else if (ALLOW_SET.size > 0) {
      // Allow-list is configured AND the user is on neither it nor any
      // membership: hard lockout. Same as before Phase D.
      return NextResponse.redirect(new URL("/not-authorized", request.url));
    }
    // Local dev with empty allow-list and no membership: let through
    // (matches the pre-Phase-D dev-friendly behaviour).
  }

  const finishedProfile = !!(row?.displayName && row?.visibility != null);
  const finishedAll = finishedProfile && hasMembership;

  if (path === "/onboarding") {
    // Don't re-render onboarding for users who've finished everything.
    // Lets the "I finished on mobile, PC still shows step 3" case resolve
    // on refresh.
    if (finishedAll) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return; // resume at the derived step
  }

  // Any /dashboard/* route: send to onboarding if either profile is
  // incomplete OR no membership exists. The onboarding page is aware of
  // both states and shows the right step.
  if (!hasMembership || !row?.displayName) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }
}

// Matcher covers both /dashboard (the app itself) and /onboarding so the
// auth + allow-list gates run on the wizard too - unauthenticated users
// can't reach it and non-family emails get bounced to /not-authorized.
export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"],
};
