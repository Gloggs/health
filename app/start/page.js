import Link from "next/link";
import { LoginLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HealthMark from "@/components/HealthMark";

// Public entry hub for the private-beta + public-demo model.
//
// Three doors, all honest:
//   - Solo / Family  -> the client-side demo sandbox (no account, nothing
//     saved). This is what the public + recruiters use.
//   - Full access    -> the real Kinde + Neon app, invite-only during the
//     private beta (the founder + family). Everyone else can request an
//     invite at /request-invite.
//
// Not behind the auth middleware (matcher only covers /dashboard +
// /onboarding), so it's reachable without a session.
export const metadata = {
  title: "Get started",
  description:
    "Health is a health app for families, in private beta. Try the live demo with no sign-up, or request an invite.",
};

function Bullet({ children, muted = false }) {
  return (
    <li className="flex gap-2.5 text-sm">
      {muted ? (
        <span aria-hidden className="mt-0.5 leading-none text-muted-foreground/70">○</span>
      ) : (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      )}
      <span className={muted ? "text-muted-foreground" : "text-foreground/90"}>{children}</span>
    </li>
  );
}

export default function StartPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Health, home" className="flex items-center gap-2.5">
          <HealthMark size={34} />
          <span className="leading-none">
            <span className="block font-serif text-lg font-bold">Health</span>
          </span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <LoginLink postLoginRedirectURL="/dashboard">Log in</LoginLink>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        {/* Hero */}
        <div className="mx-auto max-w-2xl pt-8 pb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Private beta
          </span>
          <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            Take Health for a spin
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Health is a health app for families. It's in private beta while we get it
            right, so full accounts are invite-only for now. The demo below is
            complete and hands-on, with no sign-up needed.
          </p>
        </div>

        {/* Cards. On mobile the recommended Family demo leads; on desktop
            it sits centre-stage between Solo and Full access. */}
        <div className="grid items-start gap-5 lg:grid-cols-3">
          {/* SOLO */}
          <section className="hover-paper order-2 rounded-2xl border bg-card p-6 shadow-paper-1 lg:order-none">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold">Solo</h2>
              <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Live demo
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Try it as one person.</p>
            <Button asChild variant="outline" className="mt-5 w-full">
              <Link href="/demo?mode=solo">Try the solo demo</Link>
            </Button>
            <ul className="mt-6 space-y-2.5">
              <Bullet>Log workouts, sleep, water, mood and meals</Bullet>
              <Bullet>Build streaks and watch your trends</Bullet>
              <Bullet>Set goals that track your real data</Bullet>
              <Bullet>Keep a private journal only you can see</Bullet>
            </ul>
          </section>

          {/* FAMILY (highlighted) */}
          <section className="hover-paper relative order-1 rounded-2xl border-2 border-primary bg-card p-6 shadow-paper-2 lg:order-none">
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
              Start here
            </span>
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold">Family</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Live demo
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Try it with a household.</p>
            <Button asChild className="mt-5 w-full">
              <Link href="/demo?mode=family">
                Try the family demo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Everything in Solo, plus:
            </p>
            <ul className="mt-3 space-y-2.5">
              <Bullet>A household of up to 7, with example data</Bullet>
              <Bullet>Family leaderboards and a shared chat room</Bullet>
              <Bullet>See each other's week, with privacy controls</Bullet>
              <Bullet>Profile-view pings and an activity feed</Bullet>
            </ul>
          </section>

          {/* FULL ACCESS (beta) */}
          <section className="hover-paper order-3 rounded-2xl border bg-muted/30 p-6 shadow-paper-1 lg:order-none">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold">Full access</h2>
              <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Beta
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Your real account.</p>
            <Button asChild variant="outline" className="mt-5 w-full bg-background">
              <LoginLink postLoginRedirectURL="/dashboard">Log in</LoginLink>
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Not in the beta yet?{" "}
              <Link href="/request-invite" className="font-semibold text-primary hover:underline">
                Request an invite
              </Link>
            </p>
            <ul className="mt-6 space-y-2.5">
              <Bullet>A real account, your data saved and synced</Bullet>
              <Bullet>Invite-only while we onboard our first families</Bullet>
              <Bullet>Everything in the demo, made permanent</Bullet>
              <Bullet muted>Opening to everyone later</Bullet>
            </ul>
          </section>
        </div>

        {/* Reassurance */}
        <div className="mx-auto mt-12 max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">
            Free to try. No sign-up for the demo. Already in the beta?{" "}
            <LoginLink
              postLoginRedirectURL="/dashboard"
              className="font-semibold text-primary hover:underline"
            >
              Log in
            </LoginLink>
          </p>
          <p className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span>Built with Next.js · Postgres (Neon) · Kinde auth</span>
            <span aria-hidden>·</span>
            <Link href="/how-its-built" className="font-semibold text-foreground hover:text-primary">
              how it's built
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
