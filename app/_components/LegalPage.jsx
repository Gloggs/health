import Link from "next/link";
import { LoginLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import HealthMark from "@/components/HealthMark";

// Shared shell for the Privacy + Terms pages. Server component — purely
// presentational, fed a sections array so the two legal pages stay in sync
// stylistically and we don't duplicate the header/footer.
export default function LegalPage({ title, updated, intro, sections }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Health, home" className="flex items-center gap-2.5">
          <HealthMark size={34} />
          <span className="leading-none">
            <span className="block font-display uppercase text-lg font-bold">Health</span>
          </span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <LoginLink postLoginRedirectURL="/dashboard">Log in</LoginLink>
        </Button>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <h1 className="mt-6 font-display uppercase text-4xl font-bold ">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        <p className="mt-4 text-base text-muted-foreground">{intro}</p>

        <div className="mt-8 space-y-6">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display uppercase text-xl font-bold">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-10 flex gap-4 border-t pt-6 text-sm">
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="text-primary hover:underline">
            Terms
          </Link>
          <Link href="/start" className="text-muted-foreground hover:text-foreground">
            Get started
          </Link>
        </div>
      </main>
    </div>
  );
}
