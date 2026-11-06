import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/utils/dbConfig";
import { USERS, MEMBERSHIPS } from "@/utils/schema";

// Gate for every /dashboard route + /onboarding.
//
// Sign-up is open to everyone (6 November 2026). After the Kinde sign-in check, a person either has a
// MEMBERSHIPS row (their own space, or a family they joined by invite) or is sent to /onboarding to make one.
// There is no email allow-list any more. The API routes check membership and family on every request
// themselves (lib/auth.js), and tests/privacy proves nobody sees anyone else's details.

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
        healthConsentAt: USERS.healthConsentAt,
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

  // No space yet: onboarding is the only page until they make one (or accept an invite at /join).
  if (!hasMembership && path !== "/onboarding") {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const finishedProfile = !!(row?.healthConsentAt && row?.displayName && row?.visibility != null);
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

  // Any /dashboard/* route: send to onboarding if there is no membership, no name, or no health data
  // agreement yet. Without the agreement nothing can be saved, so the app must not open on a screen
  // whose buttons would all be refused (found on the live site, 6 November 2026).
  if (!hasMembership || !row?.displayName || !row?.healthConsentAt) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }
}

// Matcher covers both /dashboard (the app itself) and /onboarding so the
// auth + allow-list gates run on the wizard too - unauthenticated users
// can't reach it.
export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"],
};
