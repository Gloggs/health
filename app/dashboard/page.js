"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  Tooltip as ChartTooltip,
} from "recharts";
import {
  Flame,
  Dumbbell,
  Bed,
  Droplet,
  Footprints,
  Scale,
  Check,
  ArrowRight,
  ListChecks,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle,
  Trash2,
  Activity,
  Smile,
  UtensilsCrossed,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { dateStr } from "@/lib/dates";
import { computeStreak } from "@/lib/streak";
import { etched, maybeFireStreakMilestone } from "@/lib/etchFeedback";
import { useCountUp, useTodayDate, useViewing } from "@/lib/hooks";
import {
  formatDuration,
  formatWeight,
  formatWeightDelta,
  formatWater,
  formatMl,
  formatMinutes,
  pluralize,
} from "@/lib/format";
import GlobalApi from "@/app/_services/GlobalApi";
// MonthCalendar lives below the fold and pulls a sizeable popover bundle —
// dynamic-loaded so Today's first-paint JS stays lean. ssr:false because
// the calendar is client-only (popover + date math against local time).
const MonthCalendar = dynamic(() => import("./_components/MonthCalendar"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-2xl" />,
});
import ExerciseRow from "./_components/ExerciseRow";
import RestTimer from "./_components/RestTimer";
import TodayLogList from "./_components/TodayLogList";
import AdHocTraining from "./_components/AdHocTraining";
import MiniWorkoutsCard from "./_components/MiniWorkoutsCard";
import CloseTodayCard from "./_components/CloseTodayCard";
import TallyRow from "./_components/TallyRow";
import WeeklyRecapCard from "./_components/WeeklyRecapCard";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekDots(activeDates) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7;
  for (let i = 0; i < 7; i++) {
    const cell = new Date(today);
    cell.setDate(today.getDate() - dayOfWeek + i);
    const cellStr = dateStr(cell);
    out.push({
      label: DAYS[i],
      done: activeDates.has(cellStr),
      isToday: cell.getTime() === today.getTime(),
      future: cell > today,
    });
  }
  return out;
}


// `cache: 'no-store'` is load-bearing - without it the browser can serve
// stale dashboard responses, which makes optimistic updates appear to revert.
const fetcher = (url) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`dashboard fetch failed (${r.status})`);
    return r.json();
  });

// Upsert a row keyed by date into a history array.
function upsertByDate(arr, date, patch) {
  const idx = (arr ?? []).findIndex((r) => r.date === date);
  if (idx >= 0) {
    const copy = arr.slice();
    copy[idx] = { ...copy[idx], ...patch };
    return copy;
  }
  return [{ date, ...patch }, ...(arr ?? [])];
}


// Suspense wrapper so useSearchParams (via useViewing) doesn't bail out of
// Next's static-render contract. The inner component holds all the actual
// logic; this thin shell exists only to satisfy the prerender check.
export default function TodayPage() {
  return (
    <Suspense fallback={null}>
      <TodayPageInner />
    </Suspense>
  );
}

function TodayPageInner() {
  // useTodayDate ticks at the next local midnight so leaving the page open
  // overnight rolls "today" forward without a manual reload. Embedding `today`
  // in the SWR key forces a refetch at rollover so the API returns the new
  // day's blank slate (sleep / mood / check-in / today session) instead of
  // showing yesterday's already-filled tiles.
  const today = useTodayDate();
  // viewingId is folded into the SWR key so switching between family members
  // (or back to self) refetches instead of showing stale cache. The server
  // ignores unknown ids - clamps back to the viewer - so a stale URL just
  // ends up as own-data, which is the safest possible fallback.
  const { viewingId, isViewingOther } = useViewing();
  const swrKey = `/api/dashboard?d=${today}${viewingId ? `&viewing=${encodeURIComponent(viewingId)}` : ""}`;
  // Family roster is fetched as a parallel SWR — same URL the /dashboard/family
  // page uses, so SWR dedupes if both surfaces are open. Powers the family
  // ribbon under the Today header. Skip in viewing-other mode (the viewee's
  // ribbon would just be redundant chrome).
  const { data: familyData } = useSWR(
    isViewingOther ? null : "/api/family",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );
  const familyMembers = familyData?.members ?? [];
  const familyEtchedTodayCount = familyMembers.filter((m) => m.etchedToday).length;
  const { data, mutate, isLoading } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
  });

  // Profile-view ping: one row per (viewer, viewee, day). The server's
  // unique index makes this safe to fire on every mount - duplicate calls
  // within the same day are no-ops at the DB level. Failures are silent
  // (a missed ping isn't user-facing; the bell in P2.S4 will just miss
  // one notification).
  useEffect(() => {
    if (!isViewingOther || !viewingId) return;
    GlobalApi.PingProfileView(viewingId).catch(() => {});
  }, [isViewingOther, viewingId]);

  // ===== Derive view state from the single SWR cache entry =====
  const todaySession = data?.todaySession ?? null;
  const history = data?.history?.sessions ?? [];
  const sleep = data?.today?.sleep ?? null;
  const water = data?.today?.water ?? null;
  const checkIn = data?.today?.checkIn ?? null;
  const todayCardio = data?.today?.cardio ?? [];
  const latestBody = (data?.history?.body ?? [])[0] ?? null;
  const userCtx = data?.userContext ?? null;
  const allTracked = useMemo(
    () => ({
      sleep: data?.history?.sleep ?? [],
      mood: data?.history?.mood ?? [],
      water: data?.history?.water ?? [],
      cardio: data?.history?.cardio ?? [],
      body: data?.history?.body ?? [],
      meals: data?.history?.meals ?? [],
      mini: data?.history?.mini ?? [],
    }),
    [data?.history]
  );
  const todayMeals = data?.today?.meals ?? [];
  const todayMini = data?.today?.mini ?? [];
  const todayMood = data?.today?.mood ?? null;

  // "X of 7 etched today" — used by CloseTodayCard (UX-PATTERNS §5).
  // Mirrors the streak-truth-table on Family page so the close-day
  // count matches what the rest of the app says is "logged" for today.
  // The 7 trackers: sleep, water, mood, cardio, body, meals, mini.
  // A logged session counts as bonus motivation but isn't in the 7
  // (you can close a day without working out).
  const etchedTodayCount = useMemo(() => {
    let n = 0;
    if (sleep) n += 1;
    // Water comes back as a number on data.today.water (totalMl) or as
    // an array depending on the route shape. Treat any non-zero as logged.
    if (typeof water === "number" ? water > 0 : water && water.totalMl > 0) {
      n += 1;
    }
    if (todayMood && (todayMood.mood || todayMood.energy)) n += 1;
    if (todayCardio.length > 0) n += 1;
    // Body row only counts if it landed today AND has a weight reading.
    if (
      latestBody &&
      latestBody.date === today &&
      (latestBody.weightKg != null || latestBody.weight_kg != null)
    ) {
      n += 1;
    }
    if (todayMeals.length > 0) n += 1;
    if (todayMini.some((r) => Number(r.count) > 0)) n += 1;
    return n;
  }, [
    sleep,
    water,
    todayMood,
    todayCardio,
    latestBody,
    today,
    todayMeals,
    todayMini,
  ]);
  const loading = isLoading || !data;

  // === Active-any-day streak (workouts + any logged activity) ===
  // Daily mini reps count too - a 30-second routine keeps the streak alive
  // even on rest days. We require count > 0 so an accidental tap-then-clear
  // doesn't pad the streak.
  const activeDates = useMemo(() => {
    const set = new Set();
    for (const s of history) if (s.completed) set.add(s.date);
    for (const r of allTracked.sleep) set.add(r.date);
    for (const r of allTracked.mood) if (r.mood || r.energy) set.add(r.date);
    for (const r of allTracked.water) set.add(r.date);
    for (const r of allTracked.cardio) set.add(r.date);
    for (const r of allTracked.body) if (r.weightKg) set.add(r.date);
    for (const r of allTracked.meals) set.add(r.date);
    for (const r of allTracked.mini) if (Number(r.count) > 0) set.add(r.date);
    return set;
  }, [history, allTracked]);

  // Rest-day sessions are exercise-on-the-side, not workouts. Filter them out
  // of the workout-session count so the calendar / week tally only reflects
  // genuine training days.
  const sessionDates = useMemo(
    () =>
      new Set(
        history
          .filter((s) => s.completed && s.planDayLabel !== "Rest")
          .map((s) => s.date)
      ),
    [history]
  );

  // Daily summary keyed by date - feeds heat-map popovers.
  const daySummary = useMemo(() => {
    const m = new Map();
    const get = (d) => {
      if (!m.has(d)) m.set(d, {});
      return m.get(d);
    };
    for (const r of history) if (r.completed) get(r.date).session = true;
    for (const r of allTracked.sleep) {
      const e = get(r.date);
      if (r.hours != null) e.sleepH = Number(r.hours);
      if (r.quality) e.sleepQ = r.quality;
    }
    for (const r of allTracked.mood) {
      if (!r.mood && !r.energy) continue;
      const e = get(r.date);
      if (r.mood) e.mood = r.mood;
      if (r.energy) e.energy = r.energy;
    }
    for (const r of allTracked.water) {
      if (r.totalMl) get(r.date).waterMl = Number(r.totalMl);
    }
    for (const r of allTracked.cardio) {
      if (!r.durationMinutes) continue;
      const e = get(r.date);
      e.cardioMin = (e.cardioMin || 0) + Number(r.durationMinutes);
    }
    for (const r of allTracked.body) {
      if (r.weightKg) get(r.date).weightKg = Number(r.weightKg);
    }
    for (const r of allTracked.meals) {
      const e = get(r.date);
      e.mealsCount = (e.mealsCount || 0) + 1;
      if (r.quality === 1) e.mealsJunk = (e.mealsJunk || 0) + 1;
    }
    for (const r of allTracked.mini) {
      const c = Number(r.count) || 0;
      if (c <= 0) continue;
      const e = get(r.date);
      e.miniReps = (e.miniReps || 0) + c;
    }
    return m;
  }, [history, allTracked]);

  // In viewing-other mode the server returns an authoritative streak that
  // uses the viewee's full activity set (regardless of which sections were
  // blanked for privacy). Falling back to the client computation is fine for
  // self-view - data.streak will match anyway.
  const clientStreak = useMemo(() => computeStreak(activeDates), [activeDates]);
  const streak = data?.streak ?? clientStreak;
  const streakAnim = useCountUp(streak);
  const dots = useMemo(() => weekDots(activeDates), [activeDates]);

  // Fire a stronger etch animation + on-voice toast when the streak
  // lands on 7 / 14 / 30 / 60 / 100 / 200 / 365 / 500 / 1000. Guarded
  // server-side by a localStorage marker keyed to (streak, date) so it
  // doesn't refire on every render, just once per milestone-day.
  // Skipped in viewing-other mode — we don't celebrate someone else's
  // milestone on their behalf.
  useEffect(() => {
    if (isViewingOther) return;
    maybeFireStreakMilestone(streak);
  }, [streak, isViewingOther]);

  const isRest = todaySession?.planDay?.label === "Rest";
  const isComplete = !!todaySession?.session?.completed;

  // Ambient workout context - compares this-Mon→today completed sessions to the
  // plan's training-day count, and surfaces the next non-Rest day on the plan.
  const planDays = todaySession?.planDays ?? [];
  const trainingDayTotal = planDays.filter((d) => d.label !== "Rest").length;
  const thisMondayStr = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const idx = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - idx);
    return dateStr(d);
  }, []);
  const thisWeekDone = useMemo(
    () =>
      history.filter(
        (s) =>
          s.completed &&
          s.planDayLabel !== "Rest" &&
          s.date >= thisMondayStr &&
          s.date <= today
      ).length,
    [history, thisMondayStr, today]
  );
  const DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const nextTrainingDay = useMemo(() => {
    if (planDays.length === 0) return null;
    const todayIdx = (new Date().getDay() + 6) % 7;
    for (let off = 1; off <= 7; off++) {
      const idx = (todayIdx + off) % 7;
      const d = planDays.find((x) => x.dayIndex === idx);
      if (d && d.label !== "Rest") {
        return { label: d.label, dayName: DAY_NAMES_FULL[idx], offset: off };
      }
    }
    return null;
  }, [planDays]);

  // === Onboarding: shown until all three steps are done ===
  const onboardingSteps = useMemo(() => {
    const hasCtx = !!(userCtx?.goals || userCtx?.restrictions || userCtx?.preferences);
    const hasPlan = !!todaySession?.plan;
    const hasLog = activeDates.size > 0;
    return [
      { key: "ctx", label: "Write your goals", desc: "Goals, restrictions, preferences", href: "/dashboard/settings?tab=coach", done: hasCtx },
      { key: "plan", label: "Create a weekly plan", desc: "Mark one active so it shows here", href: "/dashboard/plans", done: hasPlan },
      { key: "log", label: "Log your first day", desc: "Sleep, water, mood - anything counts", href: null, done: hasLog },
    ];
  }, [userCtx, todaySession, activeDates]);
  const showOnboarding = !loading && !onboardingSteps.every((s) => s.done);

  // === Quick log handlers - optimistic via SWR mutate() ===
  // Two-phase pattern that's more robust than mutate-with-async-function:
  //   1. push the optimistic value into the cache straight away (no revalidate)
  //   2. run the server call
  //   3. trigger a revalidation to pick up the real server state
  // On error we still revalidate so the UI ends up reflecting whatever the
  // server actually has, then surface a toast.
  const optimisticUpdate = async (patch, work) => {
    if (!data) return;
    const optimistic = patch(data);
    mutate(optimistic, { revalidate: false });
    try {
      await work();
      await mutate();
    } catch (err) {
      console.error("optimistic update failed", err);
      toast.error("Failed");
      await mutate();
    }
  };

  const saveResistance = (val) =>
    optimisticUpdate(
      (cur) => ({
        ...cur,
        today: {
          ...cur.today,
          checkIn: { ...(cur.today.checkIn ?? {}), date: today, resistance: val },
        },
      }),
      () =>
        GlobalApi.SaveCheckIn({
          date: today,
          resistance: val,
          intentionalRest: checkIn?.intentionalRest ?? false,
          note: checkIn?.note ?? null,
        })
    );

  const toggleIntentionalRest = () => {
    const next = !(checkIn?.intentionalRest ?? false);
    return optimisticUpdate(
      (cur) => ({
        ...cur,
        today: {
          ...cur.today,
          checkIn: { ...(cur.today.checkIn ?? {}), date: today, intentionalRest: next },
        },
      }),
      () =>
        GlobalApi.SaveCheckIn({
          date: today,
          resistance: checkIn?.resistance ?? null,
          intentionalRest: next,
          note: checkIn?.note ?? null,
        })
    );
  };

  const undoSession = async () => {
    if (!todaySession?.session?.id) return;
    const sid = todaySession.session.id;
    try {
      await optimisticUpdate(
        (cur) => ({
          ...cur,
          todaySession: { ...cur.todaySession, session: null, sets: [] },
          history: {
            ...cur.history,
            sessions: (cur.history.sessions ?? []).filter((s) => s.id !== sid),
          },
        }),
        () => GlobalApi.DeleteSession(sid)
      );
      toast.success("Session un-logged");
    } catch {
      /* optimisticUpdate already toasted */
    }
  };

  const completeWorkout = async () => {
    try {
      await optimisticUpdate(
        (cur) => ({
          ...cur,
          todaySession: {
            ...cur.todaySession,
            session: { ...(cur.todaySession?.session ?? {}), date: today, completed: true },
          },
        }),
        () =>
          GlobalApi.CompleteSession({
            date: today,
            planDayId: todaySession?.planDay?.id ?? null,
            notes: null,
            completed: true,
          })
      );
      toast.success("Session logged");
    } catch {
      /* already toasted */
    }
  };

  // Single onSaved/onChanged handler used by every Today subcomponent.
  // When a child can describe what changed, it
  // passes a small patch object so the SWR cache updates instantly without
  // waiting for the network refetch. Otherwise (Sleep/Cardio/Weight tiles
  // etc.) we just revalidate. A background `mutate()` always fires after
  // the optimistic update to reconcile with server truth.
  const load = (patch) => {
    if (patch?.action === "add" && patch.row) {
      mutate(
        (cur) => cur
          ? {
              ...cur,
              today: { ...cur.today, meals: [...(cur.today?.meals ?? []), patch.row] },
              history: { ...cur.history, meals: [patch.row, ...(cur.history?.meals ?? [])] },
            }
          : cur,
        { revalidate: false }
      );
    } else if (patch?.action === "delete" && patch.id != null) {
      mutate(
        (cur) => cur
          ? {
              ...cur,
              today: { ...cur.today, meals: (cur.today?.meals ?? []).filter((m) => m.id !== patch.id) },
              history: { ...cur.history, meals: (cur.history?.meals ?? []).filter((m) => m.id !== patch.id) },
            }
          : cur,
        { revalidate: false }
      );
    } else if (patch?.action === "update" && patch.row) {
      mutate(
        (cur) => cur
          ? {
              ...cur,
              today: {
                ...cur.today,
                meals: (cur.today?.meals ?? []).map((m) => (m.id === patch.row.id ? patch.row : m)),
              },
              history: {
                ...cur.history,
                meals: (cur.history?.meals ?? []).map((m) => (m.id === patch.row.id ? patch.row : m)),
              },
            }
          : cur,
        { revalidate: false }
      );
    } else if (patch?.action === "mini-set" && patch.row) {
      // SaveMini is an upsert keyed on (date, slot). Replace in place if a
      // row already exists for that slot+date, otherwise append. Mirrors
      // the same logic the dashboard API uses on the server.
      mutate(
        (cur) => {
          if (!cur) return cur;
          const upsert = (list) => {
            const arr = list ?? [];
            const idx = arr.findIndex(
              (r) => r.slot === patch.row.slot && r.date === patch.row.date
            );
            if (idx >= 0) {
              const copy = arr.slice();
              copy[idx] = patch.row;
              return copy;
            }
            return [...arr, patch.row];
          };
          return {
            ...cur,
            today: { ...cur.today, mini: upsert(cur.today?.mini) },
            history: { ...cur.history, mini: upsert(cur.history?.mini) },
          };
        },
        { revalidate: false }
      );
    }
    mutate();
  };

  // ===== Workout-flow state (sets, skip, rest timer, session notes) =====
  const [skipped, setSkipped] = useState(() => new Set());
  const toggleSkip = (id) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Rest timer config - persisted per-device so the choice sticks across sessions.
  const REST_KEY = "today.restSeconds";
  const [restSeconds, setRestSecondsState] = useState(90);
  const [restEndsAt, setRestEndsAt] = useState(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = Number(localStorage.getItem(REST_KEY));
    if (stored && stored > 0) setRestSecondsState(stored);
  }, []);
  const setRestSeconds = (s) => {
    setRestSecondsState(s);
    if (typeof window !== "undefined") localStorage.setItem(REST_KEY, String(s));
  };
  const startRest = () => setRestEndsAt(Date.now() + (restSeconds || 90) * 1000);

  // Session notes draft, mirrored back from the SWR cache.
  const [notesDraft, setNotesDraft] = useState("");
  useEffect(() => {
    setNotesDraft(data?.todaySession?.session?.notes ?? "");
  }, [data?.todaySession?.session?.notes]);

  // Group today's sets by exerciseId so each row can render its own list.
  const setsByExercise = useMemo(() => {
    const m = new Map();
    for (const s of data?.todaySession?.sets ?? []) {
      if (!m.has(s.exerciseId)) m.set(s.exerciseId, []);
      m.get(s.exerciseId).push(s);
    }
    return m;
  }, [data?.todaySession?.sets]);

  // Lazy session row: create on first set log if none exists, return its id.
  const ensureSession = async () => {
    if (todaySession?.session?.id) return todaySession.session.id;
    const r = await GlobalApi.CompleteSession({
      date: today,
      planDayId: todaySession?.planDay?.id ?? null,
      completed: false,
    });
    await mutate();
    return r?.data?.id ?? null;
  };

  const logSet = async (pe, set) => {
    try {
      const sessionId = await ensureSession();
      if (!sessionId) {
        toast.error("Couldn't open session");
        return;
      }
      await GlobalApi.LogSet({
        sessionId,
        exerciseId: pe.exerciseId,
        setNumber: set.setNumber,
        reps: set.reps,
        weight: set.weight,
        completed: true,
      });
      const prevMax = data?.exerciseMaxes?.[pe.exerciseId];
      if (
        set.weight &&
        (prevMax == null || Number(set.weight) > Number(prevMax))
      ) {
        toast.success(`New PR: ${pe.name} - ${set.weight}kg`);
      } else {
        toast.success(`Set ${set.setNumber} logged`);
      }
      startRest();
      await mutate();
    } catch {
      toast.error("Failed to log set");
    }
  };

  // Bulk-log multiple sets in one go - used by the "Mark all done as
  // prescribed" button on planned-set checklists. Sequential POSTs (the
  // session_sets table has no unique constraint we'd race on, but keeping
  // them ordered avoids confusing the rest timer / PR toast). Single mutate
  // at the end to avoid re-rendering the dashboard N times.
  const bulkLogSets = async (pe, sets) => {
    if (!sets || sets.length === 0) return;
    try {
      const sessionId = await ensureSession();
      if (!sessionId) {
        toast.error("Couldn't open session");
        return;
      }
      for (const s of sets) {
        await GlobalApi.LogSet({
          sessionId,
          exerciseId: pe.exerciseId,
          setNumber: s.setNumber,
          reps: s.reps,
          weight: s.weight,
          completed: true,
        });
      }
      const newMax = sets.reduce(
        (m, s) => Math.max(m, Number(s.weight) || 0),
        0
      );
      const prevMax = data?.exerciseMaxes?.[pe.exerciseId];
      if (newMax > 0 && (prevMax == null || newMax > Number(prevMax))) {
        toast.success(`New PR: ${pe.name} - ${newMax}kg`);
      } else {
        toast.success(`Logged ${sets.length} set${sets.length === 1 ? "" : "s"}`);
      }
      startRest();
      await mutate();
    } catch {
      toast.error("Failed to log sets");
    }
  };

  const removeSetById = async (id) => {
    try {
      await GlobalApi.RemoveSet(id);
      await mutate();
    } catch {
      toast.error("Failed");
    }
  };

  const saveSessionNotes = async () => {
    const sid = todaySession?.session?.id;
    if (!sid) return;
    const current = todaySession?.session?.notes ?? "";
    if (notesDraft === current) return;
    try {
      await GlobalApi.UpdateSession({ id: sid, notes: notesDraft || null });
      await mutate();
    } catch {
      toast.error("Failed to save notes");
    }
  };

  // === Viewing-other branch ===
  // When the URL carries ?viewing=<otherUserId>, render a parallel,
  // strictly read-only layout instead of the interactive one below. The
  // self-view JSX (write controls, optimistic-update wires, RestTimer,
  // onboarding) is left untouched - this keeps the diff surgical and
  // the existing code path battle-tested. The server has already 403'd
  // any stray write that slipped through, so this is purely a UX cleanup.
  if (isViewingOther) {
    return (
      <ViewingTodayLayout
        loading={loading}
        data={data}
        streak={streak}
        streakAnim={streakAnim}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {showOnboarding ? <OnboardingCard steps={onboardingSteps} /> : null}

      {/* Header — Today's hero. Stripped of the outer card chrome so the
          streak reads as the page itself (paper bg) rather than a tile
          floating on paper. Date in Caveat handwritten + Source Serif
          mix. Streak goes display-scale; "X of 7 logged today" is the
          quiet honest line under it. Family ribbon trails along, family
          column on the right doubles as the log progress.

          Hand-drawn rule beneath the whole block is the only divider;
          the rest of the layout breathes. Anti-Tailwind-dashboard.

          .enter-paper adds a subtle fade-up on first paint so the page
          reads as "ink drying on paper" rather than instant-grid. */}
      <div className="pt-2 pb-6 rule-handdrawn enter-paper">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0 flex-1">
            {/* Caveat handwritten weekday — the margin-note glyph. Plus
                Source Serif "21 May 2026" running underneath like a
                journal date stamp. .scribbled gives it a tiny pen-on-
                paper rotation. */}
            <p className="scribbled font-handwritten text-2xl leading-none text-primary/80">
              {new Date().toLocaleDateString("en-GB", { weekday: "long" })}
            </p>
            <p className="mt-1 font-serif text-sm tracking-tight text-muted-foreground">
              {new Date().toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            {/* The streak. Display-scale, mono, tight. No card around it.
                Fluid clamp(72→112px) via the `text-streak` Tailwind token
                added in J.4, no more discrete sm: breakpoint jump. */}
            <div className="mt-5 flex items-baseline gap-3">
              <span className="font-mono text-streak font-bold tracking-[-0.04em] tabular-nums">
                {Math.round(streakAnim)}
              </span>
              <span className="font-handwritten text-2xl leading-none text-foreground/70">
                day{streak === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-2 font-serif text-lg italic text-foreground/80">
              {streak === 0
                ? "Start with one entry."
                : streak === 1
                ? "Day one."
                : "Logged today."}
            </p>
            <p className="mt-4 text-xs">
              <span className="font-mono text-base font-bold tabular-nums text-foreground">
                {etchedTodayCount}
              </span>
              <span className="ml-1.5 text-muted-foreground">
                of 7 logged today
              </span>
            </p>
          </div>

          {/* Week rail moves to a quieter slot at the side, smaller dots
              that read as a margin annotation. */}
          <div className="flex flex-col items-end gap-2">
            <p className="font-handwritten text-base leading-none text-muted-foreground">
              this week
            </p>
            <div className="flex gap-1">
              {dots.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "text-[8px] font-medium uppercase tracking-wider",
                      d.isToday ? "text-primary" : "text-muted-foreground/60"
                    )}
                  >
                    {d.label[0]}
                  </span>
                  <div
                    className={cn(
                      "h-6 w-2.5 rounded-full transition-colors",
                      d.done
                        ? "bg-primary"
                        : d.future
                        ? "border border-dashed border-border/60 bg-transparent"
                        : "bg-muted",
                      d.isToday && !d.done && "ring-2 ring-primary/40"
                    )}
                    aria-label={`${d.label}: ${d.done ? "logged" : d.future ? "upcoming" : d.isToday ? "today" : "nothing"}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Family ribbon — sits below the streak block as a strip of
            ticked names with a soft separator. Only when family > 1. */}
        {familyMembers.length > 1 ? (
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="font-handwritten text-base text-muted-foreground">
              family
            </span>
            {familyMembers.map((m) => (
              <Link
                key={m.id}
                href={m.isMe ? "/dashboard" : `/dashboard?viewing=${m.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 transition-colors hover:text-primary",
                  m.isMe ? "text-primary" : "text-foreground/85"
                )}
                title={
                  m.etchedToday
                    ? `${m.displayName ?? "Unnamed"} logged today`
                    : `${m.displayName ?? "Unnamed"}, nothing yet`
                }
              >
                <span
                  className={cn(
                    "inline-flex h-2 w-2 rounded-full transition-colors",
                    m.etchedToday ? "bg-primary" : "border border-muted-foreground/40"
                  )}
                  aria-hidden
                />
                <span className="font-medium">
                  {m.isMe ? "You" : m.displayName ?? "Unnamed"}
                </span>
              </Link>
            ))}
            <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
              {familyEtchedTodayCount} / {familyMembers.length}
            </span>
          </div>
        ) : null}
      </div>

      {/* Weekly weigh-in nudge - surfaces a soft prompt when the last
          recorded body weight is more than a week old. The WeightTile has
          its own subtle "stale" styling but the tile is small; a banner
          above the fold makes it easier to act on. Threshold tightened
          from 14d -> 7d in P2.S5 so the nudge actually shows up weekly
          rather than once a fortnight. Hidden when the user has never
          logged a weight (no nudge until they've opted into tracking). */}
      {!loading && latestBody?.weightKg && latestBody?.date ? (() => {
        const daysSince = Math.floor(
          (new Date(today + "T00:00:00") - new Date(latestBody.date + "T00:00:00")) / 86400000
        );
        if (daysSince <= 7) return null;
        return (
          <Link
            href="/dashboard/log/body"
            className="hover-lift block rounded-2xl border border-warning/40 bg-warning/5 p-4 shadow-paper-1"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <Scale className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Time for a weigh-in</p>
                <p className="text-xs text-muted-foreground">
                  Last logged {daysSince} days ago ({formatWeight(latestBody.weightKg)}). Weekly is usually enough.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-warning" />
            </div>
          </Link>
        );
      })() : null}

      {/* Quick-log tiles - four trackable areas, inline. Mood was replaced
          by the Daily 4 below; full mood logging still lives at Log → Mood. */}
      {loading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : (
        <TodayLogList
          today={today}
          sleep={sleep}
          water={water}
          body={latestBody}
          cardio={todayCardio}
          cardioHistory={allTracked.cardio}
          meals={todayMeals}
          mood={todayMood}
          userCtx={userCtx}
        />
      )}

      {/* Weekly recap (J.6 / UX-PATTERNS "closing the week"). Self-mutes
          unless today is Sunday AND after 18:00 AND user has any activity
          this week. When it shows, it's a one-line Source-Serif-italic
          take on the week + link to Trends. Quiet by default. */}
      {!isViewingOther && !loading ? (
        <WeeklyRecapCard
          daysActive={dots.filter((d) => d.done).length}
          streak={streak}
        />
      ) : null}

      {/* Daily 4 mini-workouts - replaces the old Mood tile. Counts toward
          the activity streak so a 30-second routine keeps it alive. */}
      {loading ? (
        <Skeleton className="h-44 w-full rounded-2xl" />
      ) : (
        <MiniWorkoutsCard
          todayRows={todayMini}
          configured={userCtx?.miniExercises}
          today={today}
          onChanged={load}
        />
      )}


      {/* Daily check-in (resistance) - HTML <details> for native progressive
          disclosure (J.6). Expands by default when resistance is already
          set (so the user sees their answer + can change it). Collapsed
          by default when blank, Today is busy enough without a 3-button
          row taking up vertical space the user hasn't engaged with.
          Colour on the buttons encodes effort, left→right friction. */}
      <details
        className="group rounded-2xl bg-card p-5 shadow-paper-1 paper-texture [&_summary::-webkit-details-marker]:hidden"
        open={checkIn?.resistance != null || !!checkIn?.intentionalRest}
      >
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Today's check-in
            </p>
            <p className="mt-1 text-lg font-semibold">
              {checkIn?.resistance != null
                ? "How much did today fight you?"
                : "Did today fight you?"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {checkIn?.resistance != null
              ? "Tap again to clear."
              : "Tap to open · answer honestly."}
          </p>
        </summary>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            {
              v: 1,
              label: "Easy",
              hint: "Flowed naturally",
              ring: "border-[hsl(var(--chart-3))] bg-[hsl(var(--chart-3)/0.10)]",
              dot: "bg-[hsl(var(--chart-3))]",
            },
            {
              v: 2,
              label: "Medium",
              hint: "Some friction",
              ring: "border-warning bg-warning/10",
              dot: "bg-warning",
            },
            {
              v: 3,
              label: "Hard",
              hint: "Showed up despite resistance",
              ring: "border-primary bg-primary/10",
              dot: "bg-primary",
            },
          ].map((r) => {
            const selected = checkIn?.resistance === r.v;
            return (
              <button
                key={r.v}
                onClick={() => saveResistance(selected ? null : r.v)}
                aria-pressed={selected}
                className={cn(
                  "group rounded-xl border p-3 text-left transition-all",
                  selected ? r.ring : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full transition-colors",
                      selected ? r.dot : "bg-muted group-hover:bg-primary/40"
                    )}
                  />
                  <p className="text-sm font-semibold">{r.label}</p>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{r.hint}</p>
              </button>
            );
          })}
        </div>

        <button
          onClick={toggleIntentionalRest}
          aria-pressed={!!checkIn?.intentionalRest}
          className={cn(
            "mt-3 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
            checkIn?.intentionalRest
              ? "border-primary/40 bg-primary/5"
              : "border-border/60 hover:border-primary/30"
          )}
        >
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">Intentional rest</span>
            <span className="ml-1.5">- won't dent your discipline score.</span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0 text-[10px] font-semibold uppercase tracking-wider",
              checkIn?.intentionalRest
                ? "border-primary/60 text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            {checkIn?.intentionalRest ? "On" : "Off"}
          </span>
        </button>
      </details>

      {/* Close-the-day ritual (UX-PATTERNS §5). Always rendered when not
          viewing-other; visually escalates after the Personality preset's
          nightly prompt time. Counts "X of 7 logged today" from the same
          data the streak uses. */}
      {!isViewingOther && !loading ? (
        <CloseTodayCard
          count={etchedTodayCount}
          total={7}
          closedAt={checkIn?.closedAt ?? null}
          note={checkIn?.note ?? null}
          date={today}
          onChanged={load}
        />
      ) : null}

      {/* Today's workout */}
      {loading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : !todaySession?.plan ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListChecks className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium">No active plan</p>
            <p className="mt-1 text-xs text-muted-foreground">Create one to see today's session here.</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/plans">Go to Plans <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl",
                    isRest ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                  )}
                >
                  {isRest ? <Bed className="h-6 w-6" /> : <Dumbbell className="h-6 w-6" />}
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">
                    {todaySession.plan.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Today: <span className="font-medium text-foreground/90">{todaySession.planDay?.label ?? "Rest"}</span>
                  </p>
                </div>
              </div>
              {isComplete && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-success">
                    <Check className="h-3.5 w-3.5" /> Logged
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                      >
                        <RotateCcw className="h-3 w-3" /> Undo
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Un-log today's session?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This deletes the session row and any sets you've logged. The plan stays put.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={undoSession}
                        >
                          Un-log
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            {isRest ? (
              <>
                <AdHocTraining
                  sets={todaySession.sets ?? []}
                  exerciseMaxes={data?.exerciseMaxes}
                  disabled={isComplete}
                  onLogSet={(pe, set) => logSet(pe, set)}
                  onBulkLogSets={(pe, sets) => bulkLogSets(pe, sets)}
                  onRemoveSet={removeSetById}
                />
                {todaySession.session?.id ? (
                  <>
                    <div className="mt-4 space-y-1.5">
                      <label
                        htmlFor="session-notes"
                        className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        Session notes
                      </label>
                      <textarea
                        id="session-notes"
                        rows={2}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        onBlur={saveSessionNotes}
                        placeholder="How it felt, form cues, RPE - anything worth remembering."
                        className="w-full rounded-md border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <div className="mt-5 flex justify-end gap-2 border-t pt-4">
                      {isComplete ? null : (
                        <Button onClick={completeWorkout}>
                          <Check className="mr-1.5 h-4 w-4" /> Mark session done
                        </Button>
                      )}
                    </div>
                  </>
                ) : null}
              </>
            ) : todaySession.exercises?.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed bg-muted/30 p-6 text-center">
                <p className="text-sm font-medium">Nothing programmed for today yet.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={`/dashboard/plans/${todaySession.plan.id}`}>
                    Edit plan <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <ul className="mt-5 space-y-2 stagger-children">
                  {todaySession.exercises.map((pe) => (
                    <ExerciseRow
                      key={pe.id}
                      pe={pe}
                      sets={setsByExercise.get(pe.exerciseId) ?? []}
                      previousMax={data?.exerciseMaxes?.[pe.exerciseId] ?? null}
                      skipped={skipped.has(pe.id)}
                      disabled={isComplete}
                      onLogSet={(set) => logSet(pe, set)}
                      onBulkLogSets={(sets) => bulkLogSets(pe, sets)}
                      onRemoveSet={removeSetById}
                      onToggleSkip={() => toggleSkip(pe.id)}
                    />
                  ))}
                </ul>

                {todaySession.session?.id ? (
                  <div className="mt-4 space-y-1.5">
                    <label
                      htmlFor="session-notes"
                      className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Session notes
                    </label>
                    <textarea
                      id="session-notes"
                      rows={2}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      onBlur={saveSessionNotes}
                      disabled={isComplete}
                      placeholder="How it felt, form cues, RPE - anything worth remembering."
                      className="w-full rounded-md border bg-background px-3 py-2 text-xs outline-none focus:border-primary disabled:opacity-60"
                    />
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {trainingDayTotal > 0 ? (
                      <span>
                        This week:{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {thisWeekDone}
                        </span>
                        <span className="text-muted-foreground"> of {trainingDayTotal}</span>
                      </span>
                    ) : null}
                    {nextTrainingDay ? (
                      <span>
                        Next:{" "}
                        <span className="font-medium text-foreground">
                          {nextTrainingDay.dayName} · {nextTrainingDay.label}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {isComplete ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/plans/${todaySession.plan.id}`}>
                          Open plan editor
                        </Link>
                      </Button>
                    ) : (
                      <Button onClick={completeWorkout}>
                        <Check className="mr-1.5 h-4 w-4" /> Mark session done
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Calendar</p>
                <p className="text-lg font-semibold tabular-nums">
                  {sessionDates.size} session{sessionDates.size === 1 ? "" : "s"} logged
                </p>
              </div>
              <Link
                href="/dashboard/trends"
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
              >
                Trends <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <MonthCalendar
              sessions={activeDates}
              getDaySummary={(d) => daySummary.get(d) ?? null}
            />
          </div>
        </div>
      )}

      {/* Bottom tally row — visualises today's logged count as hand-drawn
          tally marks (SURFACES.md §1 footer). Renders nothing when count
          is zero so the empty state stays calm. */}
      {!isViewingOther && !loading ? (
        <TallyRow count={etchedTodayCount} total={7} label="logged today" />
      ) : null}

      <RestTimer
        endsAt={restEndsAt}
        seconds={restSeconds}
        onSkip={() => setRestEndsAt(null)}
        onChangeSeconds={setRestSeconds}
      />
    </div>
  );
}

function OnboardingCard({ steps }) {
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-paper-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary">Get set up</p>
          <p className="mt-1 text-base font-semibold">
            {doneCount === 0 ? "Three quick steps to make this work" : `${doneCount} of ${steps.length} done - nearly there`}
          </p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {doneCount}/{steps.length}
        </span>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((step, i) => {
          const inner = (
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                step.done
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  step.done
                    ? "bg-success/15 text-success"
                    : "bg-primary/15 text-primary"
                )}
              >
                {step.done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done && "text-muted-foreground line-through decoration-from-font"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground">{step.desc}</p>
              </div>
              {!step.done && step.href ? (
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
              ) : null}
            </div>
          );
          return (
            <li key={step.key}>
              {!step.done && step.href ? (
                <Link href={step.href} className="block hover-lift">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// =====================================================================
// Viewing-other Today layout
// =====================================================================
// A strictly read-only render of the Today screen. Used when ?viewing=
// is present and resolves to a different family member. Mirrors the
// self-view's information hierarchy (hero + tiles) but renders plain
// summary numbers instead of interactive controls. Sections the viewee
// has hidden surface as a "kept private" tile so the viewer knows the
// data exists but isn't shared, rather than appearing as a silent zero.
//
// Lives at the bottom of this file rather than in _components/ because
// it's tightly coupled to the dashboard response shape and would just
// re-export back here for nothing.
function ViewingTodayLayout({ loading, data, streak, streakAnim }) {
  if (loading || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const name = data.viewee?.displayName || "this member";
  const today = data.today ?? {};
  const history = data.history ?? {};
  const todaySession = data.todaySession ?? {};
  const isWorkoutsPrivate = !!todaySession?.private;
  const sleep = today.sleep ?? null;
  const water = today.water ?? null;
  const mood = today.mood ?? null;
  const cardio = today.cardio ?? [];
  const meals = today.meals ?? [];
  const mini = today.mini ?? [];
  const latestBody = (history.body ?? [])[0] ?? null;

  const sleepPrivate = !!sleep?.private;
  const moodPrivate = !!mood?.private;
  // Arrays go "private" via the history payload being explicitly empty
  // when the section is hidden - we infer from the visibility object.
  const vis = data.vieweeVisibility ?? {};
  const cardioPrivate = vis.cardio === false;
  const mealsPrivate = vis.meals === false;
  const bodyPrivate = vis.body === false;

  // Daily 4 always-visible totals.
  const miniTotal = mini.reduce((sum, r) => sum + (Number(r.count) || 0), 0);
  const miniHits = (mini ?? []).filter((r) => Number(r.count) > 0).length;

  // Today's workout summary (when visible).
  const planName = todaySession?.plan?.name ?? null;
  const planDayLabel = todaySession?.planDay?.label ?? null;
  const sessionDone = !!todaySession?.session?.completed;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Hero: viewee's name, the date, and their streak */}
      <div className="flex flex-col gap-5 rounded-3xl border bg-card p-6 shadow-paper-1 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {name}'s day
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only · everything {name} chose to share is below.
          </p>
        </div>
        <div className="flex items-baseline gap-2">
          <Flame className="mb-1 h-5 w-5 text-primary" />
          <span className="text-5xl font-bold leading-none tracking-tight tabular-nums sm:text-6xl">
            {Math.round(streakAnim ?? streak ?? 0)}
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            day{streak === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ViewingStat
          icon={Bed}
          label="Sleep"
          value={sleep && !sleepPrivate && sleep.hours ? formatDuration(sleep.hours) : sleep && !sleepPrivate ? "-" : null}
          sub={
            sleep && !sleepPrivate && sleep.quality
              ? `Quality ${sleep.quality}/5`
              : sleep && !sleepPrivate
              ? "no quality logged"
              : null
          }
          isPrivate={sleepPrivate}
        />
        <ViewingStat
          icon={Droplet}
          label="Water"
          value={formatWater(water?.totalMl ?? 0)}
          sub={pluralize(water?.entries?.length ?? 0, "pour", "pours")}
        />
        <ViewingStat
          icon={Smile}
          label="Mood"
          value={mood && !moodPrivate && (mood.mood || mood.energy) ? `${mood.mood ?? "-"}/${mood.energy ?? "-"}` : mood && !moodPrivate ? "-" : null}
          sub={mood && !moodPrivate ? "mood / energy" : null}
          isPrivate={moodPrivate}
        />
        <ViewingStat
          icon={Footprints}
          label="Cardio"
          value={cardioPrivate ? null : formatMinutes(cardio.reduce((m, c) => m + (Number(c.durationMinutes) || 0), 0))}
          sub={cardioPrivate ? null : `${cardio.length} session${cardio.length === 1 ? "" : "s"}`}
          isPrivate={cardioPrivate}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ViewingStat
          icon={Activity}
          label="Daily 4"
          value={String(miniTotal)}
          sub={`${miniHits}/4 slots tapped`}
        />
        <ViewingStat
          icon={UtensilsCrossed}
          label="Meals"
          value={mealsPrivate ? null : String(meals.length)}
          sub={
            mealsPrivate
              ? null
              : (() => {
                  const junk = meals.filter((m) => m.quality === 1).length;
                  return junk > 0 ? `${junk} junk flagged` : "logged today";
                })()
          }
          isPrivate={mealsPrivate}
        />
        <ViewingStat
          icon={Scale}
          label="Weight"
          value={
            bodyPrivate
              ? null
              : latestBody?.weightKg
              ? formatWeight(latestBody.weightKg)
              : "-"
          }
          sub={bodyPrivate ? null : latestBody?.date ? `as of ${latestBody.date}` : "no weigh-in yet"}
          isPrivate={bodyPrivate}
        />
        <ViewingStat
          icon={Dumbbell}
          label="Today's workout"
          value={
            isWorkoutsPrivate
              ? null
              : !planName
              ? "No plan"
              : sessionDone
              ? "Done"
              : planDayLabel ?? "Rest"
          }
          sub={
            isWorkoutsPrivate
              ? null
              : planName
              ? `${planName}${planDayLabel ? ` · ${planDayLabel}` : ""}`
              : null
          }
          isPrivate={isWorkoutsPrivate}
        />
      </div>

      {/* 7-day trends - bar charts per category + week total + WoW delta.
          Added in P3.S2 to give sisters a more competitive surface when
          looking at each other's profiles. Sections honor the viewee's
          visibility flags; hidden ones show a "Kept private" placeholder
          card with no chart. */}
      <ViewingTrends
        data={data}
        name={name}
        history={history}
        vis={vis}
        today={data.date}
      />
    </div>
  );
}

// =====================================================================
// Trend cards for viewing-mode (P3.S2)
// =====================================================================

// Trend chart palette per BRAND.md §4: tone-on-tone using ox-blood, sage,
// amber, terracotta, deep ink-grey. Works on both paper (light) and ink
// (dark) backgrounds without a theme-aware reload.
const TREND_COLORS = {
  primary: "hsl(4 69% 38%)",       // ox-blood
  green: "hsl(89 36% 36%)",        // sage
  yellow: "hsl(31 50% 48%)",       // amber
  red: "hsl(0 65% 45%)",           // warmer red
  blue: "hsl(195 35% 45%)",        // muted teal
};

// Build a per-day series for the last 14 days (oldest first). Useful
// because most chart cards want to show the most recent 7 days while
// the WoW delta needs the previous 7 to compare against.
function buildDailySeries(history, getValue, today) {
  const map = new Map();
  for (const row of history ?? []) {
    if (!row?.date) continue;
    const prev = map.get(row.date) ?? 0;
    map.set(row.date, prev + (Number(getValue(row)) || 0));
  }
  const out = [];
  const todayDate = new Date(`${today}T00:00:00`);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    out.push({
      date: key,
      label: d.toLocaleDateString("en-GB", { weekday: "narrow" }),
      value: map.get(key) ?? 0,
    });
  }
  return out;
}

function weekStats(series14) {
  const last7 = series14.slice(-7);
  const prev7 = series14.slice(0, 7);
  const total = last7.reduce((s, r) => s + (r.value || 0), 0);
  const prevTotal = prev7.reduce((s, r) => s + (r.value || 0), 0);
  return { total, prevTotal, delta: total - prevTotal };
}

function ViewingTrends({ data, name, history, vis, today }) {
  const mealsSeries = useMemo(() => {
    const map = new Map();
    for (const row of history.meals ?? []) {
      if (!row?.date) continue;
      const cur = map.get(row.date) ?? { junk: 0, mixed: 0, healthy: 0 };
      if (row.quality === 1) cur.junk += 1;
      else if (row.quality === 2) cur.mixed += 1;
      else if (row.quality === 3) cur.healthy += 1;
      else cur.mixed += 1; // null quality counts as mixed for the visual
      map.set(row.date, cur);
    }
    const out = [];
    const todayDate = new Date(`${today}T00:00:00`);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cur = map.get(key) ?? { junk: 0, mixed: 0, healthy: 0 };
      out.push({
        date: key,
        label: d.toLocaleDateString("en-GB", { weekday: "narrow" }),
        ...cur,
        total: cur.junk + cur.mixed + cur.healthy,
      });
    }
    return out;
  }, [history.meals, today]);

  const mealsWeek = useMemo(() => {
    const junk = mealsSeries.reduce((s, r) => s + r.junk, 0);
    const total = mealsSeries.reduce((s, r) => s + r.total, 0);
    return { junk, total };
  }, [mealsSeries]);

  const miniSeries = useMemo(
    () => buildDailySeries(history.mini ?? [], (r) => r.count, today),
    [history.mini, today]
  );
  const miniWeek = useMemo(() => weekStats(miniSeries), [miniSeries]);

  const cardioSeries = useMemo(
    () => buildDailySeries(history.cardio ?? [], (r) => r.durationMinutes, today),
    [history.cardio, today]
  );
  const cardioWeek = useMemo(() => weekStats(cardioSeries), [cardioSeries]);

  const sleepSeries = useMemo(
    () => buildDailySeries(history.sleep ?? [], (r) => r.hours, today),
    [history.sleep, today]
  );

  const sessionsSeries = useMemo(
    () =>
      buildDailySeries(
        history.sessions ?? [],
        (r) => (r.completed ? 1 : 0),
        today
      ),
    [history.sessions, today]
  );
  const sessionsWeek = useMemo(() => weekStats(sessionsSeries), [sessionsSeries]);

  // Weight is a line chart - take the latest weigh-in per day (or null).
  const bodySeries = useMemo(() => {
    const map = new Map();
    for (const row of history.body ?? []) {
      if (!row?.date || !row?.weightKg) continue;
      // Per-day: keep the row with the highest createdAt as the day's value.
      const cur = map.get(row.date);
      if (!cur || new Date(row.createdAt) > new Date(cur.createdAt)) {
        map.set(row.date, { weight: Number(row.weightKg), createdAt: row.createdAt });
      }
    }
    const out = [];
    const todayDate = new Date(`${today}T00:00:00`);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const entry = map.get(key);
      out.push({
        date: key,
        label: d.toLocaleDateString("en-GB", { weekday: "narrow" }),
        value: entry?.weight ?? null,
      });
    }
    return out;
  }, [history.body, today]);

  const hasAnyData =
    mealsWeek.total > 0 ||
    miniWeek.total > 0 ||
    cardioWeek.total > 0 ||
    sleepSeries.slice(-7).some((d) => d.value > 0) ||
    sessionsWeek.total > 0 ||
    bodySeries.some((d) => d.value != null);

  if (!hasAnyData) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 px-1">
        <Activity className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">{name}'s last 7 days</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Meals - stacked bars (sisters specifically asked for this) */}
        <TrendCard
          icon={UtensilsCrossed}
          title="Meals"
          metric={
            <>
              {mealsWeek.total} <span className="text-xs font-medium text-muted-foreground">logged</span>
            </>
          }
          sub={
            mealsWeek.junk > 0
              ? `${mealsWeek.junk} junk flagged this week`
              : "no junk flagged this week"
          }
          isPrivate={!vis.meals}
        >
          <MealsTrendChart series={mealsSeries.slice(-7)} />
        </TrendCard>

        {/* Daily 4 - bar chart of reps (always visible) */}
        <TrendCard
          icon={Activity}
          title="Daily 4"
          metric={
            <>
              {miniWeek.total} <span className="text-xs font-medium text-muted-foreground">reps</span>
            </>
          }
          sub={<WeekDelta delta={miniWeek.delta} suffix="reps" />}
        >
          <SimpleBarChart
            series={miniSeries.slice(-7)}
            color={TREND_COLORS.primary}
            unit="reps"
          />
        </TrendCard>

        <TrendCard
          icon={Footprints}
          title="Cardio"
          metric={
            <>
              {cardioWeek.total} <span className="text-xs font-medium text-muted-foreground">min</span>
            </>
          }
          sub={<WeekDelta delta={cardioWeek.delta} suffix="min" />}
          isPrivate={!vis.cardio}
        >
          <SimpleBarChart
            series={cardioSeries.slice(-7)}
            color={TREND_COLORS.green}
            unit="min"
          />
        </TrendCard>

        <TrendCard
          icon={Bed}
          title="Sleep"
          metric={(() => {
            const lastWeek = sleepSeries.slice(-7);
            const logged = lastWeek.filter((d) => d.value > 0);
            if (logged.length === 0) return "-";
            const avg = logged.reduce((s, d) => s + d.value, 0) / logged.length;
            return (
              <>
                {formatDuration(avg)} <span className="text-xs font-medium text-muted-foreground">avg</span>
              </>
            );
          })()}
          sub={(() => {
            const lastWeek = sleepSeries.slice(-7);
            const logged = lastWeek.filter((d) => d.value > 0).length;
            return `${logged}/7 nights logged`;
          })()}
          isPrivate={!vis.sleep}
        >
          <SimpleBarChart
            series={sleepSeries.slice(-7)}
            color={TREND_COLORS.blue}
            unit="h"
          />
        </TrendCard>

        <TrendCard
          icon={Dumbbell}
          title="Workouts"
          metric={
            <>
              {sessionsWeek.total} <span className="text-xs font-medium text-muted-foreground">done</span>
            </>
          }
          sub={<WeekDelta delta={sessionsWeek.delta} suffix="sessions" />}
          isPrivate={!vis.workouts}
        >
          <SimpleBarChart
            series={sessionsSeries.slice(-7)}
            color={TREND_COLORS.primary}
            unit="sessions"
          />
        </TrendCard>

        <TrendCard
          icon={Scale}
          title="Weight"
          metric={(() => {
            const points = bodySeries.filter((d) => d.value != null);
            const latest = points[points.length - 1];
            if (!latest) return "-";
            return (
              <>
                {Number(latest.value).toFixed(1)} <span className="text-xs font-medium text-muted-foreground">kg</span>
              </>
            );
          })()}
          sub={(() => {
            const points = bodySeries.filter((d) => d.value != null);
            if (points.length < 2) return "1 reading or less";
            const first = points[0].value;
            const last = points[points.length - 1].value;
            const diff = last - first;
            return `${formatWeightDelta(diff)} over 14 days`;
          })()}
          isPrivate={!vis.body}
        >
          <WeightTrendChart series={bodySeries} />
        </TrendCard>
      </div>
    </div>
  );
}

function WeekDelta({ delta, suffix }) {
  if (!delta) return <span className="text-muted-foreground">vs last week: flat</span>;
  const positive = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        positive ? "text-success" : "text-muted-foreground"
      )}
    >
      {positive ? "+" : ""}
      {delta} {suffix} vs last week
    </span>
  );
}

function TrendCard({ icon: Icon, title, metric, sub, isPrivate, children }) {
  if (isPrivate) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-4">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {title}
            </p>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">Kept private</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-card p-4 shadow-paper-1 paper-texture">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums">{metric}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="mt-3 h-24 w-full">{children}</div>
    </div>
  );
}

// Shared tooltip styling for viewing-mode charts. Matches the dark-card
// surface and uses primary-tint border so it reads as on-theme rather than
// the recharts default white. `formatter` and `labelFormatter` props on the
// individual charts handle the actual content shape.
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "11px",
    color: "hsl(var(--popover-foreground))",
  },
  labelStyle: {
    color: "hsl(var(--muted-foreground))",
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "2px",
  },
  cursor: { fill: "hsl(var(--primary) / 0.08)" },
};

// Build a human-readable day label from the YYYY-MM-DD date column on each
// series row - "Mon · 18 May" reads better in a tooltip than just "M".
function tooltipDayLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function SimpleBarChart({ series, color, unit = "" }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
        />
        <ChartTooltip
          {...TOOLTIP_STYLE}
          formatter={(value) => [unit ? `${value} ${unit}` : value, ""]}
          labelFormatter={(_label, payload) =>
            tooltipDayLabel(payload?.[0]?.payload?.date)
          }
          separator=""
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MealsTrendChart({ series }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
        />
        <ChartTooltip
          {...TOOLTIP_STYLE}
          formatter={(value, name) => [
            value,
            name.charAt(0).toUpperCase() + name.slice(1),
          ]}
          labelFormatter={(_label, payload) =>
            tooltipDayLabel(payload?.[0]?.payload?.date)
          }
        />
        <Bar dataKey="healthy" stackId="m" fill={TREND_COLORS.green} radius={[0, 0, 0, 0]} />
        <Bar dataKey="mixed" stackId="m" fill={TREND_COLORS.yellow} radius={[0, 0, 0, 0]} />
        <Bar dataKey="junk" stackId="m" fill={TREND_COLORS.red} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function WeightTrendChart({ series }) {
  // Drop nulls so recharts doesn't draw breaks; the line connects the
  // logged points which is what a weight trend wants to show.
  const points = series.filter((d) => d.value != null);
  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
        No weigh-ins in this window.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
        />
        <ChartTooltip
          {...TOOLTIP_STYLE}
          formatter={(value) => [formatWeight(value), ""]}
          labelFormatter={(_label, payload) =>
            tooltipDayLabel(payload?.[0]?.payload?.date)
          }
          separator=""
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={TREND_COLORS.primary}
          strokeWidth={2}
          dot={{ r: 3, fill: TREND_COLORS.primary }}
          activeDot={{ r: 5, fill: TREND_COLORS.primary }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ViewingStat({ icon: Icon, label, value, sub, isPrivate }) {
  if (isPrivate) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-4">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">Kept private</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-card p-4 shadow-paper-1 paper-texture">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums">
            {value ?? "-"}
          </p>
          {sub ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
