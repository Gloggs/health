"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { LoginLink } from "@kinde-oss/kinde-auth-nextjs/components";
import {
  Dumbbell,
  Flame,
  NotebookPen,
  MessageCircle,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Check,
  Tag,
  Zap,
  CheckCircle2,
  Bed,
  Droplet,
  Smile,
  UtensilsCrossed,
  Target,
  TrendingUp,
  ShieldCheck,
  Users,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCountUp, useInView } from "@/lib/hooks";
import { formatDuration, formatWater, formatMinutes } from "@/lib/format";
import HealthMark from "@/components/HealthMark";
import InteractiveEtch from "./_components/InteractiveEtch";
import GameSection from "./_components/games/GameSection";

function GridBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
    />
  );
}

function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="animate-blob absolute -top-32 -left-20 h-[420px] w-[420px] rounded-full bg-primary/30 blur-[110px]" />
      <div
        className="animate-blob absolute -top-10 right-0 h-[380px] w-[380px] rounded-full bg-chart-2/25 blur-[110px]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="animate-blob absolute bottom-0 left-1/3 h-[340px] w-[340px] rounded-full bg-chart-5/20 blur-[100px]"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}

// Subtle mouse-tracking 3D tilt. Reads pointer position relative to the
// element and writes CSS variables that the mock's transform uses. The
// max angle is intentionally small (±5deg) — strong enough to feel
// alive, small enough not to look like a gimmick.
//
// Honours prefers-reduced-motion: when set, the ref still attaches but
// the values stay at 0 so the transform is a no-op.
function useMouseTilt(maxDeg = 5) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let rafId = 0;
    let targetRx = 0;
    let targetRy = 0;
    let currentRx = 0;
    let currentRy = 0;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width; // 0..1
      const py = (e.clientY - r.top) / r.height; // 0..1
      // y-axis tilt (around horizontal): mouse top → tilt back; bottom → forward
      targetRx = (0.5 - py) * 2 * maxDeg;
      // x-axis tilt: mouse right → tilt right
      targetRy = (px - 0.5) * 2 * maxDeg;
      if (!rafId) rafId = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      targetRx = 0;
      targetRy = 0;
      if (!rafId) rafId = requestAnimationFrame(tick);
    };
    const tick = () => {
      // Linear interpolate toward target — gives a damped, eased feel
      // without a heavyweight animation library.
      currentRx += (targetRx - currentRx) * 0.15;
      currentRy += (targetRy - currentRy) * 0.15;
      el.style.setProperty("--tilt-rx", currentRx.toFixed(2) + "deg");
      el.style.setProperty("--tilt-ry", currentRy.toFixed(2) + "deg");
      if (Math.abs(currentRx - targetRx) > 0.05 || Math.abs(currentRy - targetRy) > 0.05) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [maxDeg]);
  return ref;
}

function HeroMock() {
  const streak = useCountUp(14);
  const sessions = useCountUp(48);
  const tiltRef = useMouseTilt(5);

  const heat = useMemo(() => {
    const cols = [];
    let seed = 7;
    for (let w = 0; w < 14; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        seed = (seed * 9301 + 49297) % 233280;
        const r = seed / 233280;
        const isWeekend = d >= 5;
        const active = isWeekend ? r > 0.85 : r > 0.32;
        col.push({ active, intensity: active ? Math.min(4, Math.ceil(r * 4)) : 0 });
      }
      cols.push(col);
    }
    return cols;
  }, []);

  const planExercises = [
    { name: "Bench Press", target: "4 × 8 @ 80kg", done: true },
    { name: "Incline DB Press", target: "3 × 10 @ 22.5kg", done: true },
    { name: "Cable Fly", target: "3 × 12", done: false },
    { name: "Triceps Pushdown", target: "3 × 12 @ 25kg", done: false },
  ];

  return (
    <div
      ref={tiltRef}
      className="relative w-full max-w-md"
      style={{
        // Lay the children on a 3D plane so the tilt looks dimensional
        // rather than skewed. The CSS variables get updated by the
        // useMouseTilt RAF loop above.
        perspective: "1200px",
        transform: "rotateX(var(--tilt-rx, 0deg)) rotateY(var(--tilt-ry, 0deg))",
        transformStyle: "preserve-3d",
        transition: "transform 150ms ease-out",
        willChange: "transform",
      }}
    >
      {/* Main: today's workout */}
      <div className="animate-float-slow rounded-2xl border bg-card p-5 shadow-paper-2 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              PPL · Week 6
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">Push day</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Dumbbell className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2">
          <Flame className="h-5 w-5 text-primary" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums">{Math.round(streak)}</span>
            <span className="text-xs text-muted-foreground">day streak</span>
          </div>
          <div className="ml-auto flex gap-0.5">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className={`h-4 w-1.5 rounded-full ${i < 5 ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>

        <ul className="mt-4 space-y-1.5">
          {planExercises.map((ex, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-lg border p-2 text-xs transition-colors ${
                ex.done ? "border-success/30 bg-success/5" : "border-border bg-card"
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md ${
                  ex.done ? "bg-success text-success-foreground" : "border bg-muted"
                }`}
              >
                {ex.done ? <Check className="h-3.5 w-3.5" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{ex.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{ex.target}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Floating top-right: heat map */}
      <div
        className="animate-float-slower absolute -right-6 -top-4 hidden w-56 rounded-xl border bg-card p-3 shadow-paper-2 sm:block"
        style={{ animationDelay: "-3s" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Last 14 weeks
          </p>
          <span className="text-[10px] tabular-nums text-primary">{Math.round(sessions)}</span>
        </div>
        <div className="mt-2 flex gap-[2px]">
          {heat.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[2px]">
              {col.map((cell, ri) => (
                <div
                  key={ri}
                  className={`h-2.5 w-2.5 rounded-[2px] ${
                    cell.active ? `heat-${cell.intensity}` : "heat-empty"
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Floating left: daily-log preview */}
      <div
        className="animate-float-slow absolute -left-8 bottom-6 hidden w-52 rounded-xl border bg-card p-3 shadow-paper-2 sm:block"
        style={{ animationDelay: "-2s" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Today
          </p>
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <ul className="mt-2 space-y-1.5 text-[11px]">
          <li className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Bed className="h-3 w-3 text-[hsl(var(--chart-5))]" /> Sleep
            </span>
            <span className="font-semibold tabular-nums">{formatDuration(7.5)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Droplet className="h-3 w-3 text-[hsl(var(--chart-4))]" /> Water
            </span>
            <span className="font-semibold tabular-nums">{formatWater(1800)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <UtensilsCrossed className="h-3 w-3 text-primary" /> Meals
            </span>
            <span className="font-semibold tabular-nums">3 · 1 junk</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Smile className="h-3 w-3 text-[hsl(var(--chart-2))]" /> Mood
            </span>
            <span className="font-semibold tabular-nums">4/5</span>
          </li>
        </ul>
      </div>

      {/* Floating pill: progress */}
      <div
        className="animate-float-slow absolute -right-3 bottom-2 hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs shadow-paper-1 sm:flex"
        style={{ animationDelay: "-2s" }}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        2 of 4 done
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Brand lockup: tally mark IS the logo (BRAND.md §2). Wordmark
            in Source Serif so the landing reads as on-brand the moment
            it lands above the fold. */}
        <a href="#top" aria-label="Health, home" className="flex items-center gap-2.5 group">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center transition-transform group-hover:-rotate-2">
            <HealthMark size={36} />
          </span>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="font-serif text-base font-bold">Health</span>
          </div>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          <Link href="/demo" className="font-medium text-foreground transition-colors hover:text-primary">
            Live demo
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="h-9 sm:hidden">
            <Link href="/demo">Demo</Link>
          </Button>
          <Button asChild size="sm" className="h-9">
            <LoginLink postLoginRedirectURL="/dashboard">Sign in</LoginLink>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100vh-57px)] items-center overflow-hidden">
      <GridBg />
      <Blobs />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="space-y-7">

          <h1
            className="animate-fade-up text-balance font-serif text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "100ms" }}
          >
            The family health app that makes you{" "}
show up.
          </h1>

          <p
            className="animate-fade-up max-w-xl text-pretty text-lg text-muted-foreground"
            style={{ animationDelay: "200ms" }}
          >
            Log every workout, meal, and night's sleep by hand. Hold each
            other accountable. Real progress, not metrics. The friction is
            the feature - writing it down is what changes you.
          </p>

          <div
            className="animate-fade-up flex flex-wrap items-center gap-3"
            style={{ animationDelay: "300ms" }}
          >
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/demo">
                Try the live demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 bg-card px-6 text-base"
            >
              <Link href="/start">Get started</Link>
            </Button>
            <a
              href="#features"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              See what's inside <ChevronRight className="h-4 w-4" />
            </a>
          </div>
          <p
            className="animate-fade-up -mt-2 text-xs text-muted-foreground"
            style={{ animationDelay: "340ms" }}
          >
            The demo is the real app on sample data, no sign-up, nothing saved.
          </p>

          {/* The brand gesture, distilled. Lets the visitor experience
              the log interaction before signing in, clicks add tally
              strokes via the same SVG animation the in-app log uses. */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "380ms" }}
          >
            <InteractiveEtch />
          </div>

          <div
            className="animate-fade-up grid grid-cols-3 gap-4 border-t border-border/60 pt-6"
            style={{ animationDelay: "460ms" }}
          >
            <Trust label="By hand" value="No auto-import" />
            <Trust label="Family" value="Up to 7 members" />
            <Trust label="Journal" value="Always private" />
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <HeroMock />
        </div>
      </div>
    </section>
  );
}

function Trust({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

const FEATURES = [
  {
    icon: Dumbbell,
    title: "Workouts that learn",
    body: "Build a weekly plan, log sets as you do them, get a quiet PR badge when you beat your max. Rest timer auto-starts after every set.",
  },
  {
    icon: NotebookPen,
    title: "Daily logs in seconds",
    body: "Sleep, water, mood, cardio, weight, meals. Most tiles are one tap. Custom water amount, last-night sleep auto-fills, junk meals get flagged.",
  },
  {
    icon: Flame,
    title: "Discipline beats willpower",
    body: "Once a day: how much did today fight you? Easy / Medium / Hard. Intentional rest days don't dent the score. The signal is showing up, not the volume.",
  },
  {
    icon: Users,
    title: "See how everyone's doing",
    body: "Tap a family member to view their week - trends, leaderboards, last-seen pings. A shared chat room for the family. Each person picks what they share via 8 visibility toggles.",
  },
  {
    icon: Target,
    title: "Goals you can actually see",
    body: "'Bench 100kg', 'Weigh 75kg', 'Max 3 junk meals/week'. Progress bars update from real data - sets, body weight, this week's meals. Hit, miss, or close.",
  },
  {
    icon: TrendingUp,
    title: "Trends without spreadsheets",
    body: "Heat map for daily activity, weekly charts for everything you log, this-week-vs-last-week deltas at the top. No CSV exports required (but available).",
  },
];

function Features() {
  const [ref, inView] = useInView();
  return (
    <section id="features" ref={ref} className="border-t bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className={`mx-auto max-w-2xl text-center ${inView ? "animate-fade-up" : "opacity-0"}`}>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">What's in it</p>
          <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Six modules. One app. No AI guessing for you.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Every part does one thing well. Together they answer the only
            question that matters: did I show up today?
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className={`group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-paper-2 ${
                inView ? "animate-fade-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${100 + i * 80}ms` }}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    icon: NotebookPen,
    title: "Set up once",
    body: "Sign in, tell the app your name and DOB, build a weekly plan, set a couple of goals. Two minutes.",
  },
  {
    n: "02",
    icon: Flame,
    title: "Log daily",
    body: "Open the app, tap a few tiles, mark today's workout done. Streak grows automatically.",
  },
  {
    n: "03",
    icon: Users,
    title: "Cheer each other on",
    body: "Peek at the Family tab to see who's on a streak, check last-week's leaderboards, drop a note in the family room.",
  },
];

function How() {
  const [ref, inView] = useInView();
  return (
    <section id="how" ref={ref} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className={`mx-auto max-w-2xl text-center ${inView ? "animate-fade-up" : "opacity-0"}`}>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">How it works</p>
          <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Three steps.
          </h2>
        </div>
        <div className="relative mt-14 grid gap-8 md:grid-cols-3">
          <div className="absolute left-12 right-12 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {STEPS.map(({ n, icon: Icon, title, body }, i) => (
            <div
              key={n}
              className={`relative ${inView ? "animate-fade-up" : "opacity-0"}`}
              style={{ animationDelay: `${120 + i * 120}ms` }}
            >
              <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-primary bg-background text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-xs font-semibold tracking-wider text-primary">STEP {n}</p>
              <h3 className="mt-1 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Preview() {
  const [ref, inView] = useInView();

  const tiles = [
    { icon: Bed, label: "Sleep", value: formatDuration(7.5), toneClass: "bg-[hsl(var(--chart-5)/0.15)] text-[hsl(var(--chart-5))]" },
    { icon: Droplet, label: "Water", value: formatWater(1800), toneClass: "bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))]" },
    { icon: Smile, label: "Mood", value: "4 / 5", toneClass: "bg-[hsl(var(--chart-2)/0.18)] text-[hsl(var(--chart-2))]" },
    { icon: Flame, label: "Cardio", value: formatMinutes(30), toneClass: "bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))]" },
  ];

  const meals = [
    { slot: "Breakfast", quality: 3, text: "Oats + berries" },
    { slot: "Lunch", quality: 2, text: "Chicken sandwich" },
    { slot: "Dinner", quality: 1, text: "Pizza" },
  ];

  return (
    <section id="preview" ref={ref} className="relative overflow-hidden border-t bg-muted/30 py-24">
      <Blobs />
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
        <div className={`space-y-5 ${inView ? "animate-fade-up" : "opacity-0"}`}>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">A day in Health</p>
          <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            One screen. One tap per thing. No AI doing it for you.
          </h2>
          <p className="text-base text-muted-foreground">
            Today fits on a single scroll. Streak and the week at the top.
            Tap-tiles for sleep, water, mood, cardio, and your Daily 4.
            Meals get their own row. The act of pressing each button is the
            mechanism - not a barcode scan, not an algorithm guessing, not a
            watch judging you. You. Showing up.
          </p>
          <ul className="space-y-2.5 text-sm">
            {[
              "One round-trip to load the dashboard - endpoint consolidation built in",
              "Optimistic updates: tap water and the number bumps instantly",
              "Hit a new PR? Toast appears, badge sticks on the exercise card",
              "8 visibility toggles per person - each one controls what siblings see when they view your profile",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-muted-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className={`space-y-3 ${inView ? "animate-fade-up" : "opacity-0"}`}
          style={{ animationDelay: "150ms" }}
        >
          {/* Tile row */}
          <div className="grid grid-cols-4 gap-2">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.label}
                  className="rounded-xl border bg-card p-3 shadow-paper-1"
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-md ${t.toneClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="mt-2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t.label}
                  </p>
                  <p className="text-base font-bold tabular-nums">{t.value}</p>
                </div>
              );
            })}
          </div>

          {/* Meals card */}
          <div className="rounded-2xl bg-card p-4 shadow-paper-1 paper-texture">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Meals</p>
              </div>
              <p className="text-xs text-muted-foreground">
                3 logged · <span className="text-destructive">1 junk</span> · <span className="text-success">1 healthy</span>
              </p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {meals.map((m) => (
                <li
                  key={m.slot}
                  className="flex items-center justify-between rounded-lg border bg-card px-2.5 py-1.5 text-xs"
                >
                  <span className="font-medium">{m.slot}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{m.text}</span>
                    <span
                      className={`rounded-full border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider ${
                        m.quality === 1
                          ? "border-destructive/40 bg-destructive/15 text-destructive"
                          : m.quality === 2
                          ? "border-warning/40 bg-warning/15 text-warning"
                          : "border-success/40 bg-success/15 text-success"
                      }`}
                    >
                      {m.quality === 1 ? "Junk" : m.quality === 2 ? "Mixed" : "Healthy"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Family room preview */}
          <div className="rounded-2xl bg-card p-4 shadow-paper-1 paper-texture">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Family room</p>
              <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                Shared
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                  MA
                </span>
                <span className="rounded-2xl bg-muted px-3 py-1.5 text-foreground/90">
                  Smashed the bench PR today.
                </span>
              </li>
              <li className="flex flex-row-reverse gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                  ME
                </span>
                <span className="rounded-2xl bg-primary px-3 py-1.5 text-primary-foreground">
                  Catching up on Daily 4 - 200 reps by 9pm or it's losing
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section className="border-t py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-2">
        <div>
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
            Each person controls what the family sees
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Eight visibility toggles per person - body, age, height, sleep, mood,
            cardio, meals, workouts. Streak and Daily 4 totals stay visible (header
            data, by design). Your journal is always private. When someone opens
            your profile, you get a quiet ping - one per viewer per day - so you
            always know who's looking.
          </p>
        </div>
        <ul className="space-y-2 text-sm">
          {[
            "8 visibility toggles per person - flip any section off without telling anyone",
            "Journal stays private. Always. Not togglable.",
            "Profile-view pings - one row per viewer per day, surfaced in the bell",
            "Family chat stays inside your household, so no one outside your family can read it",
            "Your data is yours, never sold and never used to train AI",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2 rounded-lg border bg-card p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-24">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.20),transparent_60%)]"
      />
      <div className="mx-auto max-w-3xl px-6 text-center">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Zap className="h-3 w-3 text-primary" /> Sign in once, you're done
        </div>
        <h2 className="text-balance font-serif text-4xl font-bold tracking-tight sm:text-5xl">
          The hard part is showing up. The app handles the rest.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Build a plan, tap a few tiles, write a sentence when something matters.
          Once a week, you'll know what's actually going on.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link href="/start">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 bg-card px-6 text-base"
          >
            <Link href="/demo">Try the demo first</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center">
            <HealthMark size={22} />
          </span>
          <span>© {new Date().getFullYear()} Health</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <span className="inline-flex items-center gap-1.5">
            <Tag className="h-3 w-3" /> Built with Next.js, Kinde, Neon
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Features />
      <How />
      <Preview />
      <Privacy />
      {/* Dessert, not a detour: the mini-games sit after the product
          story so first-time visitors meet the pitch before the play. */}
      <GameSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
