import Link from "next/link";
import { LoginLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HealthMark from "@/components/HealthMark";

// Honest "how it's built" page for the curious (and recruiters). Linked from
// /start's footer. Every claim here is kept true to what's actually in the
// codebase — no compliance/certification claims that haven't been earned.
export const metadata = {
  title: "How it's built",
  description:
    "The stack, architecture, security and accessibility behind Health, a real, deployed multi-tenant health app.",
};

const SECTIONS = [
  {
    title: "Stack",
    points: [
      "Next.js 14 (App Router) and React, styled with Tailwind CSS",
      "Postgres on Neon, accessed through the Drizzle ORM",
      "Authentication handled by Kinde",
      "Deployed on Vercel",
    ],
  },
  {
    title: "Architecture",
    points: [
      "Multi-tenant by design: every record is scoped to a household and a user",
      "Each API route runs through a shared server-side auth wrapper, so the per-user filter is structurally hard to forget",
      "SWR on the client with optimistic updates, so taps feel instant",
      "Reads and writes are separated cleanly for the read-only viewing mode",
    ],
  },
  {
    title: "Security",
    points: [
      "Every API route is gated server-side; unauthenticated calls get a 401",
      "Data is filtered per tenant on each query, so households never see each other's data",
      "All user input is validated and length-clamped before it touches the database",
      "Queries go through a parameterised ORM, never hand-built SQL strings",
      "Secrets stay server-side; the access gate fails closed if misconfigured",
    ],
  },
  {
    title: "Accessibility",
    points: [
      "Keyboard navigable, with a visible focus ring on every interactive element",
      "A skip-to-content link for keyboard and screen-reader users",
      "Honours prefers-reduced-motion: animations stand down when asked",
      "Form controls are labelled; colour is never the only signal",
    ],
  },
  {
    title: "Privacy",
    points: [
      "Eight per-person visibility controls decide what the family can see",
      "Your journal is always private and never shared",
      "Your data is yours: never sold, never used to train AI",
    ],
  },
];

export default function HowItsBuiltPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
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

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <Link
          href="/start"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Under the hood
          </p>
          <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">
            How Health is built
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Health is a real, deployed product, not a prototype. A family uses it for
            real every day. Here's what's under the hood.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {SECTIONS.map((section) => (
            <section key={section.title} className="rounded-2xl border bg-card p-6 shadow-paper-1">
              <h2 className="font-serif text-xl font-bold">{section.title}</h2>
              <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                {section.points.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <p className="font-serif text-lg font-bold">See it in action</p>
          <p className="text-sm text-muted-foreground">
            The fastest way to judge a build is to use it. The demo needs no sign-up.
          </p>
          <Button asChild>
            <Link href="/start">
              Try the demo <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
