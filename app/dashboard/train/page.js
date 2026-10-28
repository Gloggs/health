"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListChecks, Dumbbell, ArrowRight, Activity, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHero from "../_components/PageHero";
import { daysAgoStr, prettyDate, todayDateStr, weekStartStr } from "@/lib/dates";

export default function TrainHubPage() {
  const today = todayDateStr();
  const weekStart = weekStartStr();
  const [plans, setPlans] = useState(null);
  const [exerciseCount, setExerciseCount] = useState(null);
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    Promise.all([
      GlobalApi.ListPlans(),
      GlobalApi.ListExercises(),
      GlobalApi.GetSessions({ from: daysAgoStr(60), to: today }),
    ])
      .then(([p, e, s]) => {
        setPlans(p.data ?? []);
        setExerciseCount((e.data ?? []).length);
        setSessions(s.data ?? []);
      })
      .catch(() => {
        setPlans([]);
        setExerciseCount(0);
        setSessions([]);
      });
  }, [today]);

  const activePlan = plans?.find((p) => p.isActive) ?? null;
  const planCount = plans?.length ?? 0;

  // Exclude rest-day sessions from the workout count - they're tracked but
  // shouldn't show up as "this week's training" because the plan called for rest.
  const completed = useMemo(
    () => (sessions ?? []).filter((s) => s.completed && s.planDayLabel !== "Rest"),
    [sessions]
  );
  const lastSession = completed[0] ?? null;
  const daysSince = useMemo(() => {
    if (!lastSession?.date) return null;
    const a = new Date(lastSession.date + "T00:00:00");
    const b = new Date(today + "T00:00:00");
    return Math.max(0, Math.floor((b - a) / 86400000));
  }, [lastSession?.date, today]);
  const thisWeekCount = useMemo(
    () => completed.filter((s) => s.date >= weekStart && s.date <= today).length,
    [completed, weekStart, today]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHero
        eyebrow="train"
        title="Your training side"
        subtitle="Plan, library, last sessions."
      />

      {plans === null ? (
        <Skeleton className="h-44 w-full rounded-2xl" />
      ) : activePlan ? (
        <div className="rounded-2xl border bg-card p-6 shadow-paper-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Activity className="h-2.5 w-2.5" /> Active
              </span>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{activePlan.name}</p>
              {activePlan.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{activePlan.description}</p>
              ) : null}
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/plans/${activePlan.id}`}>
                Edit plan <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-5">
            <Stat
              icon={Target}
              label="This week"
              value={
                activePlan.trainingDays
                  ? `${thisWeekCount}/${activePlan.trainingDays}`
                  : String(thisWeekCount)
              }
              hint={activePlan.trainingDays ? "of planned" : "logged"}
            />
            <Stat
              icon={Clock}
              label="Last session"
              value={
                daysSince == null
                  ? "-"
                  : daysSince === 0
                  ? "today"
                  : daysSince === 1
                  ? "1 d ago"
                  : `${daysSince} d ago`
              }
              hint={lastSession?.date ? prettyDate(lastSession.date) : "none yet"}
            />
            <Stat
              icon={Dumbbell}
              label="Programmed"
              value={String(activePlan.exerciseCount ?? 0)}
              hint={
                activePlan.trainingDays
                  ? `${activePlan.trainingDays}d train · ${activePlan.restDays}d rest`
                  : "exercises"
              }
            />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListChecks className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium">No active plan yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Build a weekly plan and mark it active to see your week here.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/dashboard/plans">Create a plan</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <HubLink
          href="/dashboard/plans"
          icon={ListChecks}
          label="Plans"
          sub={planCount === 0 ? "Build your first weekly plan" : `${planCount} plan${planCount === 1 ? "" : "s"}`}
        />
        <HubLink
          href="/dashboard/exercises"
          icon={Dumbbell}
          label="Exercise library"
          sub={exerciseCount === null ? "-" : `${exerciseCount} moves`}
        />
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Recent sessions</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-7">
            <Link href="/dashboard" className="text-xs">
              Open Today <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        {sessions === null ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : completed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No completed workouts yet. Mark today's session done on the Today screen and it'll show here.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {completed.slice(0, 5).map((s, i) => {
              const dateObj = new Date(s.date + "T00:00:00");
              const dayName = dateObj.toLocaleDateString("en-GB", { weekday: "short" });
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={
                        i === 0
                          ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
                          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                      }
                    >
                      <Dumbbell className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{prettyDate(s.date)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {dayName} · {s.notes ? s.notes.slice(0, 60) : "no notes"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {s.durationMinutes ? `${s.durationMinutes} min` : "logged"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] font-medium uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function HubLink({ href, icon: Icon, label, sub }) {
  return (
    <Link
      href={href}
      className="hover-lift group flex items-center gap-4 rounded-2xl bg-card p-5 shadow-paper-1 paper-texture transition-all hover:border-primary/40"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">{label}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
