// The front page (health v2, 6 November 2026). Guild UK Skeleton v2: white, soft green and forest fields,
// DM Sans, square corners, one idea per section. The one live thing is the summary itself, shown with sample data.
// Every claim here is true of the app today (private by default, no scores or advice, free).
import Link from "next/link";
import { LoginLink } from "@kinde-oss/kinde-auth-nextjs/components";
import HealthMark from "@/components/HealthMark";
import SummarySheet from "@/components/summary/SummarySheet";

export const metadata = {
  title: { absolute: "health: get ready for your GP appointment" },
  description: "Write down what is going on, in your own words, and show your GP one clear page: what, since when, what helps, your medicines and your questions. Free, and private by default.",
};

const REGISTER = "/api/auth/register?post_login_redirect_url=%2Fonboarding";

// Made up for this page, and labelled as such.
const SAMPLE = {
  writtenBy: "Sam (sample)",
  writtenOn: "2026-11-06",
  period: { from: "2026-10-10", to: "2026-11-06" },
  appointmentDate: "2026-11-10",
  happening: [{
    what: "Headache", since: "2026-10-28", daysWritten: 4, where: ["Forehead"],
    entries: [
      { date: "2026-10-28", howBad: "mild", note: null },
      { date: "2026-11-01", howBad: "moderate", note: "Woke up with it" },
      { date: "2026-11-03", howBad: "moderate", note: null },
      { date: "2026-11-05", howBad: "mild", note: null },
    ],
  }],
  better: ["Water and a rest", "Fresh air"],
  worse: ["Long days at a screen"],
  around: [],
  medicines: ["Paracetamol when needed"],
  questions: ["Why does it keep coming back?", "Could it be my screen time?"],
  footer: "These are my own words, written down using health. Your GP decides what this means.",
};

const STEPS = [
  ["Write it down when it happens", "A few words: what, where, how bad, and what helps. It takes under a minute."],
  ["Add your questions and medicines", "The NHS suggests bringing your 2 or 3 most important questions and a list of your medicines. health keeps them with your notes."],
  ["Show it, print it or save it as a PDF", "One page, in the order the NHS suggests: what is happening and since when, what helps, your medicines and your questions."],
];

const PRIVATE = [
  "How you feel, your notes and your journal are never shared with anyone.",
  "If you share with family, they see only the numbers you switch on, and never your words.",
  "Download or delete everything at any time, from Settings.",
];

function Header() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="health home">
          <HealthMark size={32} />
          <span className="text-xl font-medium tracking-tight">health</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-4" aria-label="Main">
          <a href="#how" className="hidden px-2 py-2 text-sm underline-offset-4 hover:underline sm:inline">How it works</a>
          <Link href="/demo" className="px-2 py-2 text-sm underline-offset-4 hover:underline">Try the demo</Link>
          <LoginLink postLoginRedirectURL="/dashboard" className="inline-flex h-11 items-center bg-primary px-4 text-sm font-medium text-primary-foreground">Sign in</LoginLink>
        </nav>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:py-20">
          <div className="space-y-6">
            <h1 className="font-display text-[2.6rem] font-medium leading-[1.05] tracking-tight sm:text-6xl">Get ready for your GP appointment.</h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Write down what is going on, in your own words. health turns it into one clear page for your GP: what is happening, since when, what helps, your medicines and your questions.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="inline-flex h-12 items-center justify-center bg-primary px-6 text-base font-medium text-primary-foreground">Try the demo</Link>
              <a href={REGISTER} className="inline-flex h-12 items-center justify-center bg-secondary px-6 text-base font-medium text-secondary-foreground">Create a free account</a>
            </div>
            <p className="text-sm text-muted-foreground">Free, and private to your account. The demo uses sample data and saves nothing.</p>
          </div>
          <figure className="space-y-2">
            <div className="bg-secondary p-3 sm:p-4">
              <SummarySheet s={SAMPLE} />
            </div>
            <figcaption className="text-sm text-muted-foreground">A sample page, made up for this example.</figcaption>
          </figure>
        </section>

        <section id="how" aria-labelledby="how-title" className="bg-secondary">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 id="how-title" className="font-display text-3xl font-medium tracking-tight sm:text-4xl">How it works</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map(([title, text]) => (
                <li key={title} className="space-y-2 bg-background p-6">
                  <h3 className="text-xl font-medium">{title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="private-title" className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="space-y-4">
            <h2 id="private-title" className="font-display text-3xl font-medium tracking-tight sm:text-4xl">Private by default</h2>
            <ul className="space-y-3 text-lg leading-relaxed">
              {PRIVATE.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <p><Link href="/privacy" className="underline underline-offset-4">Read the privacy page</Link></p>
          </div>
          <div className="space-y-4 bg-secondary p-6 sm:p-8">
            <h2 className="font-display text-2xl font-medium tracking-tight">What health is not</h2>
            <p className="leading-relaxed">
              health is not medical advice. It keeps your words in order and never scores, rates or diagnoses anything. Your GP decides what it means.
            </p>
            <p className="leading-relaxed">If you need help urgently, call NHS 111, or 999 in an emergency.</p>
          </div>
        </section>

        <section aria-labelledby="also-title" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 id="also-title" className="text-xl font-medium">Also in health</h2>
            <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">
              Sleep, water, meals, mood, workouts and a private journal, and a family space where each person chooses what to share.
            </p>
          </div>
        </section>

        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-3xl font-medium tracking-tight">See it with sample data</h2>
              <p className="mt-2 opacity-90">No sign-up, and nothing is saved.</p>
            </div>
            <Link href="/demo" className="inline-flex h-12 items-center justify-center bg-background px-6 text-base font-medium text-foreground">Try the demo</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <HealthMark size={22} />
            <span>health is an open source project by Michael Ijisonuwe.</span>
          </div>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link href="/privacy" className="underline underline-offset-4">Privacy</Link>
            <Link href="/terms" className="underline underline-offset-4">Terms</Link>
            <Link href="/how-its-built" className="underline underline-offset-4">How it is built</Link>
            <a href="https://github.com/Gloggs/health" className="underline underline-offset-4">Source code</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
