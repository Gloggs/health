"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import {
  LineChart as ChartIcon,
  Bed,
  Droplet,
  Smile,
  Scale,
  Dumbbell,
  Footprints,
  Flame,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Minus,
  UtensilsCrossed,
  Activity,
} from "lucide-react";
import { Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { todayDateStr, daysAgoStr, prettyDate, weekStartStr } from "@/lib/dates";
import { daily, dailySum, weekly, mean, movingAverage } from "@/lib/aggregate";
import { computeWeeklyDiscipline } from "@/lib/discipline";
import {
  formatDuration,
  formatHoursDecimal,
  formatWeight,
  formatWeightDelta,
  formatWater,
  formatMl,
  formatScoreOf5,
  formatScoreOf10,
} from "@/lib/format";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHero from "../../_components/PageHero";
import SharedEmptyState from "../../_components/states/EmptyState";
import { DEFAULT_MINI_EXERCISES } from "@/lib/mini";

const RANGES = [
  { key: "7d", label: "7 days", days: 6 },
  { key: "30d", label: "30 days", days: 29 },
  { key: "90d", label: "90 days", days: 89 },
  { key: "1y", label: "1 year", days: 364 },
  // "All time" caps at ~5 years - covers the lifetime of a personal tracker
  // without unbounded queries. Weight chart benefits most: the longer the
  // window, the more the trend line tells you about your trajectory.
  { key: "all", label: "All time", days: 1825 },
];

// Trend chart palette per BRAND.md §4 — tone-on-tone, works on both
// paper (light) and ink (dark) backgrounds.
const COLORS = {
  primary: "hsl(4 69% 38%)",       // ox-blood
  blue: "hsl(195 35% 45%)",        // muted teal
  green: "hsl(89 36% 36%)",        // sage
  yellow: "hsl(31 50% 48%)",       // amber
  purple: "hsl(280 30% 45%)",      // muted plum
  muted: "hsl(31 14% 45%)",        // wash
};

function tickDate(d) {
  // Render only the day-month bit to keep ticks compact.
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TrendsPage() {
  const today = todayDateStr();
  const [rangeKey, setRangeKey] = useState("30d");
  // Global granularity toggle. Defaults to "daily" because sparse weekly
  // bars (e.g. 5 weeks with one bar at the right) read as broken, whereas
  // the same data shown per-day is dense and legible. Persisted because
  // power users tend to settle on one cadence and stick with it.
  const [granularity, setGranularity] = useState("daily");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("trends.granularity");
    if (saved === "daily" || saved === "weekly") setGranularity(saved);
  }, []);
  const setGranularityPersisted = (g) => {
    setGranularity(g);
    try {
      window.localStorage.setItem("trends.granularity", g);
    } catch {
      /* private mode — preference is session-only */
    }
  };
  const isDaily = granularity === "daily";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    sessions: [],
    sleep: [],
    water: [],
    mood: [],
    body: [],
    cardio: [],
    checkIns: [],
    meals: [],
    mini: [],
  });
  // Weight-goal target line on the body chart. Pulled once on mount - it's
  // small and changes rarely, so it doesn't share the range refetch cycle.
  const [weightGoal, setWeightGoal] = useState(null);
  // Daily 4 labels/targets (configurable via the card's cog). Loaded once;
  // falls back to defaults when the user hasn't customised them.
  const [miniConfig, setMiniConfig] = useState(null);

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const from = daysAgoStr(range.days);
  const to = today;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      GlobalApi.GetSessions({ from, to }),
      GlobalApi.GetSleep({ from, to }),
      GlobalApi.GetWater({ from, to }),
      GlobalApi.GetMood({ from, to }),
      GlobalApi.GetBody({ from, to }),
      GlobalApi.GetCardio({ from, to }),
      GlobalApi.GetCheckIn({ from, to }),
      GlobalApi.GetMeals({ from, to }),
      GlobalApi.GetMini({ from, to }),
    ])
      .then(([s, sl, w, m, b, c, ck, ml, mi]) => {
        setData({
          sessions: s.data ?? [],
          sleep: sl.data ?? [],
          water: w.data ?? [],
          mood: m.data ?? [],
          body: b.data ?? [],
          cardio: c.data ?? [],
          checkIns: ck.data ?? [],
          meals: ml.data ?? [],
          mini: mi.data ?? [],
        });
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    GlobalApi.ListGoals()
      .then((r) => {
        const goals = r.data ?? [];
        const wg = goals.find((g) => g.active && g.kind === "weight" && g.targetValue != null);
        setWeightGoal(wg ? Number(wg.targetValue) : null);
      })
      .catch(() => setWeightGoal(null));
    GlobalApi.GetUserContext()
      .then((r) => setMiniConfig(r.data?.miniExercises ?? null))
      .catch(() => setMiniConfig(null));
  }, []);

  // === Series ===
  const sleepHours = useMemo(
    () => daily(data.sleep, from, to, (r) => (r.hours == null ? null : Number(r.hours))),
    [data.sleep, from, to]
  );
  const sleepQuality = useMemo(
    () => daily(data.sleep, from, to, (r) => (r.quality == null ? null : Number(r.quality))),
    [data.sleep, from, to]
  );
  const waterDaily = useMemo(
    () => dailySum(data.water, from, to, "totalMl"),
    [data.water, from, to]
  );
  const moodDaily = useMemo(
    () => daily(data.mood, from, to, (r) => r.mood ?? null),
    [data.mood, from, to]
  );
  const energyDaily = useMemo(
    () => daily(data.mood, from, to, (r) => r.energy ?? null),
    [data.mood, from, to]
  );
  const weightSeries = useMemo(
    () => daily(data.body, from, to, (r) => (r.weightKg == null ? null : Number(r.weightKg))),
    [data.body, from, to]
  );
  const sessionsPerWeek = useMemo(
    () =>
      weekly(
        // Rest-day sessions don't count toward the weekly workout total.
        data.sessions.filter((s) => s.completed && s.planDayLabel !== "Rest"),
        from,
        to,
        (rows) => rows.length
      ),
    [data.sessions, from, to]
  );
  // Per-day workout series — one bar per day, height = number of completed
  // non-rest sessions logged that day. Multiple sessions in a day are
  // additive; most days it'll be 0 or 1.
  const sessionsDaily = useMemo(
    () =>
      dailySum(
        data.sessions.filter((s) => s.completed && s.planDayLabel !== "Rest"),
        from,
        to,
        () => 1
      ),
    [data.sessions, from, to]
  );
  const cardioMinutesPerWeek = useMemo(
    () =>
      weekly(data.cardio, from, to, (rows) =>
        rows.reduce((s, r) => s + (Number(r.durationMinutes) || 0), 0)
      ),
    [data.cardio, from, to]
  );
  const cardioMinutesDaily = useMemo(
    () => dailySum(data.cardio, from, to, (r) => Number(r.durationMinutes) || 0),
    [data.cardio, from, to]
  );
  const disciplineWeekly = useMemo(() => {
    // Group check-ins and sessions by week, then score per week.
    const checkInsByMonday = new Map();
    const sessionsByMonday = new Map();
    const mondayOf = (d) => {
      const x = new Date(d + "T00:00:00");
      const idx = (x.getDay() + 6) % 7;
      x.setDate(x.getDate() - idx);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    };
    for (const c of data.checkIns) {
      const k = mondayOf(c.date);
      if (!checkInsByMonday.has(k)) checkInsByMonday.set(k, []);
      checkInsByMonday.get(k).push(c);
    }
    for (const s of data.sessions) {
      if (!s.completed) continue;
      const k = mondayOf(s.date);
      if (!sessionsByMonday.has(k)) sessionsByMonday.set(k, new Set());
      sessionsByMonday.get(k).add(s.date);
    }
    // Use the cardio bucket helper to get dense weeks
    return cardioMinutesPerWeek.map(({ weekStart }) => {
      const cins = checkInsByMonday.get(weekStart) ?? [];
      const sdates = sessionsByMonday.get(weekStart) ?? new Set();
      const { score10 } = computeWeeklyDiscipline(cins, sdates);
      return { weekStart, value: score10 };
    });
  }, [data.checkIns, data.sessions, cardioMinutesPerWeek]);

  // Weekly meals broken down by quality - stacked bar.
  const mealsWeekly = useMemo(
    () =>
      weekly(data.meals, from, to, (rows) => ({
        junk: rows.filter((r) => r.quality === 1).length,
        mixed: rows.filter((r) => r.quality === 2).length,
        healthy: rows.filter((r) => r.quality === 3).length,
        unscored: rows.filter((r) => r.quality == null).length,
      })),
    [data.meals, from, to]
  );
  // Per-day meals breakdown — same shape as weekly but one row per day.
  // Built directly off data.meals rather than going through dailySum because
  // we need to fan out into four count buckets, not one numeric total.
  const mealsDailyChart = useMemo(() => {
    const byDate = new Map();
    for (const m of data.meals ?? []) {
      const k = m.date;
      if (!byDate.has(k)) byDate.set(k, { junk: 0, mixed: 0, healthy: 0, unscored: 0 });
      const bucket = byDate.get(k);
      if (m.quality === 1) bucket.junk += 1;
      else if (m.quality === 2) bucket.mixed += 1;
      else if (m.quality === 3) bucket.healthy += 1;
      else bucket.unscored += 1;
    }
    // Dense series across the range — empty days render as zero bars.
    const out = [];
    const start = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const v = byDate.get(k) ?? { junk: 0, mixed: 0, healthy: 0, unscored: 0 };
      out.push({ date: k, ...v });
    }
    return out;
  }, [data.meals, from, to]);
  // Per-day discipline score derived from check-ins. Each check-in's
  // resistance + showed-up booleans become a 0–10 per-day score so the
  // user can see day-to-day shape rather than only the weekly rollup.
  const disciplineDaily = useMemo(() => {
    const byDate = new Map();
    for (const c of data.checkIns ?? []) byDate.set(c.date, c);
    const out = [];
    const start = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const c = byDate.get(k);
      if (!c) {
        out.push({ date: k, value: null });
        continue;
      }
      // Same scoring math as computeWeeklyDiscipline but applied per-day:
      // base 5/10 for checking in, +3 if showedUp, +2 for low resistance.
      let score = 5;
      if (c.showedUp) score += 3;
      const r = Number(c.resistance);
      if (Number.isFinite(r)) {
        if (r <= 3) score += 2;
        else if (r <= 6) score += 1;
      }
      out.push({ date: k, value: Math.max(0, Math.min(10, score)) });
    }
    return out;
  }, [data.checkIns, from, to]);

  // Flatten the weekly() output (which puts the object in `value`) for recharts.
  const mealsWeeklyChart = useMemo(
    () =>
      mealsWeekly.map((r) => ({
        weekStart: r.weekStart,
        junk: r.value.junk,
        mixed: r.value.mixed,
        healthy: r.value.healthy,
        unscored: r.value.unscored,
      })),
    [mealsWeekly]
  );

  // Daily 4 per-slot daily series. Missing days = 0 reps (rather than null)
  // so the sparkline reads as "zero day" instead of a gap. Computed for all
  // four slots even if some are unused; empty ones render an empty state.
  const miniExercises = useMemo(
    () => (Array.isArray(miniConfig) && miniConfig.length === 4 ? miniConfig : DEFAULT_MINI_EXERCISES),
    [miniConfig]
  );
  const miniSeriesPerSlot = useMemo(
    () =>
      [0, 1, 2, 3].map((slot) =>
        dailySum(
          (data.mini ?? []).filter((r) => r.slot === slot),
          from,
          to,
          (r) => Number(r.count) || 0
        )
      ),
    [data.mini, from, to]
  );
  const miniStatsPerSlot = useMemo(
    () =>
      miniSeriesPerSlot.map((series) => {
        const values = series.map((d) => Number(d.value) || 0);
        const total = values.reduce((s, v) => s + v, 0);
        const max = values.length === 0 ? 0 : Math.max(0, ...values);
        const daysActive = values.filter((v) => v > 0).length;
        return { total, max, daysActive };
      }),
    [miniSeriesPerSlot]
  );

  // === Summary stats ===
  const stats = useMemo(() => {
    const avgSleep = mean(sleepHours.map((d) => d.value));
    const avgWater = mean(waterDaily.map((d) => d.value).filter((v) => v > 0));
    const avgMood = mean(moodDaily.map((d) => d.value));
    const sessionsCount = data.sessions.filter(
      (s) => s.completed && s.planDayLabel !== "Rest"
    ).length;
    const cardioTotalMin = data.cardio.reduce((s, r) => s + (Number(r.durationMinutes) || 0), 0);
    const junkCount = data.meals.filter((m) => m.quality === 1).length;
    const healthyCount = data.meals.filter((m) => m.quality === 3).length;
    return { avgSleep, avgWater, avgMood, sessionsCount, cardioTotalMin, junkCount, healthyCount };
  }, [sleepHours, waterDaily, moodDaily, data.sessions, data.cardio, data.meals]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHero
        eyebrow="trends"
        title="Trends"
        subtitle="Everything you've logged, visualised."
        right={
          <div className="flex flex-wrap items-center gap-2">
            {/* Daily / Weekly toggle. Lives next to the range selector
                because the two pickers describe the same axis (what's on
                the x-axis: a day or a week's bucket). Daily is the default
                because sparse weekly bars over a 30-day window read as
                broken; daily is denser and more legible. */}
            <div
              role="group"
              aria-label="Chart granularity"
              className="inline-flex rounded-full border bg-card p-0.5"
            >
              {[
                { key: "daily", label: "Daily" },
                { key: "weekly", label: "Weekly" },
              ].map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGranularityPersisted(g.key)}
                  aria-pressed={granularity === g.key}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    granularity === g.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-full border bg-card p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRangeKey(r.key)}
                  aria-pressed={rangeKey === r.key}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    rangeKey === r.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Week-over-week comparison - always shows this Mon→today vs last Mon→Sun. */}
      <WeekCompare today={today} />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <KpiCard icon={Bed} label="Avg sleep" value={stats.avgSleep == null ? "-" : formatDuration(stats.avgSleep)} />
        <KpiCard icon={Droplet} label="Avg water" value={stats.avgWater == null ? "-" : formatWater(stats.avgWater)} />
        <KpiCard icon={Smile} label="Avg mood" value={stats.avgMood == null ? "-" : formatScoreOf5(stats.avgMood)} />
        <KpiCard icon={Dumbbell} label="Sessions" value={stats.sessionsCount} />
        <KpiCard icon={Footprints} label="Cardio (min)" value={stats.cardioTotalMin} />
        <KpiCard
          icon={UtensilsCrossed}
          label="Healthy / junk"
          value={`${stats.healthyCount} / ${stats.junkCount}`}
        />
      </div>

      {/* Discipline — daily defaults to per-day check-in score, weekly
          rolls the same data up using the established discipline math. */}
      <ChartCard
        icon={Flame}
        title="Follow-through score"
        subtitle={
          isDaily
            ? "Per-day check-in score 0–10. Higher = showed up despite resistance."
            : "Weekly discipline 0–10. Higher = showed up despite resistance."
        }
      >
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : (isDaily ? disciplineDaily : disciplineWeekly).every((d) => d.value == null) ? (
          <EmptyState text="No daily check-ins yet. Tap the resistance card on Today to start scoring." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={isDaily ? disciplineDaily : disciplineWeekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey={isDaily ? "date" : "weekStart"}
                tickFormatter={tickDate}
                tick={{ fontSize: 11, fill: COLORS.muted }}
              />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: COLORS.muted }} width={28} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => (isDaily ? prettyDate(d) : `Week of ${prettyDate(d)}`)}
                formatter={(v) => [v == null ? "-" : formatScoreOf10(v), "Score"]}
              />
              <Line type="monotone" dataKey="value" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Daily 4 - per-slot sparklines so the user sees the rep trajectory
          at a glance. Sits next to discipline because both are about daily
          consistency. */}
      <ChartCard
        icon={Activity}
        title="Daily 4 mini-workouts"
        subtitle="Reps over the selected range. Each panel is one of your four slots."
      >
        {loading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((slot) => (
              <MiniSparklineCard
                key={slot}
                exercise={miniExercises[slot]}
                series={miniSeriesPerSlot[slot]}
                stats={miniStatsPerSlot[slot]}
              />
            ))}
          </div>
        )}
      </ChartCard>

      {/* Sleep */}
      <ChartCard icon={Bed} title="Sleep" subtitle="Hours per night. Quality as the dotted overlay (1–5).">
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : sleepHours.every((d) => d.value == null) && sleepQuality.every((d) => d.value == null) ? (
          <EmptyState text="No sleep entries yet." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={sleepHours.map((d, i) => ({ date: d.date, hours: d.value, quality: sleepQuality[i].value }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tickFormatter={tickDate} tick={{ fontSize: 11, fill: COLORS.muted }} />
              <YAxis yAxisId="hours" tick={{ fontSize: 11, fill: COLORS.muted }} width={28} domain={[0, 12]} />
              <YAxis yAxisId="quality" orientation="right" tick={{ fontSize: 11, fill: COLORS.muted }} width={24} domain={[0, 5]} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => prettyDate(d)}
                formatter={(v, name) => {
                  if (name === "hours") return [v == null ? "-" : formatDuration(v), "Sleep"];
                  if (name === "quality") return [v == null ? "-" : formatScoreOf5(v), "Quality"];
                  return [v, name];
                }}
              />
              <ReferenceLine y={7} yAxisId="hours" stroke={COLORS.muted} strokeDasharray="3 3" label={{ value: "7h", fontSize: 10, fill: COLORS.muted, position: "right" }} />
              <Area yAxisId="hours" type="monotone" dataKey="hours" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.18} strokeWidth={2} connectNulls />
              <Line yAxisId="quality" type="monotone" dataKey="quality" stroke={COLORS.purple} strokeWidth={2} strokeDasharray="3 3" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Water */}
      <ChartCard icon={Droplet} title="Water" subtitle="Daily intake (ml). Target 2500 ml shown as a reference line.">
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : waterDaily.every((d) => d.value === 0) ? (
          <EmptyState text="No water logged yet." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={waterDaily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tickFormatter={tickDate} tick={{ fontSize: 11, fill: COLORS.muted }} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} width={40} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => prettyDate(d)}
                formatter={(v) => [formatWater(v), "Water"]}
              />
              <ReferenceLine y={2500} stroke={COLORS.muted} strokeDasharray="3 3" />
              <Bar dataKey="value" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Mood + Energy */}
      <ChartCard icon={Smile} title="Mood + energy" subtitle="Daily 1–5 self-reports.">
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : moodDaily.every((d) => d.value == null) && energyDaily.every((d) => d.value == null) ? (
          <EmptyState text="No mood entries yet." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodDaily.map((d, i) => ({ date: d.date, mood: d.value, energy: energyDaily[i].value }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tickFormatter={tickDate} tick={{ fontSize: 11, fill: COLORS.muted }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: COLORS.muted }} width={24} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => prettyDate(d)}
              />
              <Line type="monotone" dataKey="mood" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls name="Mood" />
              <Line type="monotone" dataKey="energy" stroke={COLORS.yellow} strokeWidth={2} dot={{ r: 3 }} connectNulls name="Energy" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Body weight - the headline trend for this app. Shows raw weigh-ins,
          a 14-day moving average to smooth daily noise, and a goal reference
          line if the user set a weight goal. KPIs below summarise change. */}
      <WeightTrendCard
        loading={loading}
        weightSeries={weightSeries}
        weightGoal={weightGoal}
      />

      {/* Meals — stacked by quality. Per-day shows individual meal counts
          across the range (so a 30-day window has up to 30 bars); weekly
          rolls them up into 7-day buckets keyed by Monday. */}
      <ChartCard
        icon={UtensilsCrossed}
        title={isDaily ? "Meals per day" : "Meals per week"}
        subtitle="Stacked by quality: healthy, mixed, junk. Skipped meals don't appear."
      >
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : data.meals.length === 0 ? (
          <EmptyState text="No meals logged in this range." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={isDaily ? mealsDailyChart : mealsWeeklyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey={isDaily ? "date" : "weekStart"}
                tickFormatter={tickDate}
                tick={{ fontSize: 11, fill: COLORS.muted }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.muted }} width={24} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => (isDaily ? prettyDate(d) : `Week of ${prettyDate(d)}`)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="healthy" stackId="meals" fill={COLORS.green} name="Healthy" radius={[0, 0, 0, 0]} />
              <Bar dataKey="mixed" stackId="meals" fill={COLORS.yellow} name="Mixed" />
              <Bar dataKey="junk" stackId="meals" fill="hsl(var(--destructive))" name="Junk" />
              <Bar dataKey="unscored" stackId="meals" fill={COLORS.muted} name="Unscored" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Sessions — daily shows one bar per training day (0/1/2+);
          weekly aggregates by ISO week. */}
      <ChartCard
        icon={Dumbbell}
        title={isDaily ? "Workouts per day" : "Workouts per week"}
        subtitle={
          isDaily
            ? "Completed sessions. Most days will be 0 or 1; multi-session days stack."
            : "Completed sessions, grouped by ISO week (Mon-Sun)."
        }
      >
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : (isDaily ? sessionsDaily : sessionsPerWeek).every((d) => d.value === 0) ? (
          <EmptyState text="No completed workouts in this range." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={isDaily ? sessionsDaily : sessionsPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey={isDaily ? "date" : "weekStart"}
                tickFormatter={tickDate}
                tick={{ fontSize: 11, fill: COLORS.muted }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.muted }} width={24} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => (isDaily ? prettyDate(d) : `Week of ${prettyDate(d)}`)}
                formatter={(v) => [v, "Sessions"]}
              />
              <Bar dataKey="value" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Cardio — daily sums minutes per day so rest days show as
          empty bars; weekly aggregates to ISO week. */}
      <ChartCard
        icon={Footprints}
        title={isDaily ? "Cardio minutes per day" : "Cardio minutes per week"}
        subtitle="Total walking, running, cycling, etc."
      >
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : (isDaily ? cardioMinutesDaily : cardioMinutesPerWeek).every((d) => d.value === 0) ? (
          <EmptyState text="No cardio logged in this range." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={isDaily ? cardioMinutesDaily : cardioMinutesPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey={isDaily ? "date" : "weekStart"}
                tickFormatter={tickDate}
                tick={{ fontSize: 11, fill: COLORS.muted }}
              />
              <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} width={28} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => (isDaily ? prettyDate(d) : `Week of ${prettyDate(d)}`)}
                formatter={(v) => [`${Math.round(v)} min`, "Cardio"]}
              />
              <Bar dataKey="value" fill={COLORS.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

// Headline weight visualisation. Raw weigh-ins as a primary line, a
// 14-day moving average (trailing) as a smoother overlay, and an optional
// dashed goal-weight reference line. Below the chart: first, latest, min,
// max, and delta - the numbers most worth obsessing over.
function WeightTrendCard({ loading, weightSeries, weightGoal }) {
  const hasAny = weightSeries.some((d) => d.value != null);
  // Trailing 14-day MA - sparse weight data benefits from a smoother that
  // looks back through gaps rather than only computing on dense windows.
  const movingAvg = useMemo(() => movingAverage(weightSeries, 14), [weightSeries]);
  // Merge raw + MA into one dataset so Recharts can render both lines.
  const chartData = useMemo(
    () => weightSeries.map((d, i) => ({ date: d.date, weight: d.value, ma: movingAvg[i]?.value ?? null })),
    [weightSeries, movingAvg]
  );

  const stats = useMemo(() => {
    const points = weightSeries.filter((d) => d.value != null);
    if (points.length === 0) return null;
    const values = points.map((d) => Number(d.value));
    const first = points[0];
    const latest = points[points.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const delta = Number(latest.value) - Number(first.value);
    return { first, latest, min, max, delta };
  }, [weightSeries]);

  // Subtitle reflects what's actually on the chart so it's honest about the
  // data thinness (e.g. "1 entry in the range" → encourages logging).
  const pointCount = weightSeries.filter((d) => d.value != null).length;
  const subtitle = !hasAny
    ? "Logged weight over time. Weekly cadence is plenty."
    : pointCount === 1
    ? "Only one weigh-in in this range - log another to see a trend."
    : `${pointCount} weigh-ins. Solid line = raw, dotted = 14-day average.`;

  return (
    <div className="rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Scale className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold tracking-tight">Body weight</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {weightGoal != null ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Goal {weightGoal} kg
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : !hasAny ? (
        <EmptyState text="No weight entries yet. Add one from the Weight tile on Today." />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tickFormatter={tickDate} tick={{ fontSize: 11, fill: COLORS.muted }} />
              <YAxis
                tick={{ fontSize: 11, fill: COLORS.muted }}
                width={40}
                domain={[
                  (dataMin) => Math.min(dataMin, weightGoal ?? dataMin) - 1.5,
                  (dataMax) => Math.max(dataMax, weightGoal ?? dataMax) + 1.5,
                ]}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => prettyDate(d)}
                formatter={(v, name) => [
                  v == null ? "-" : formatWeight(v),
                  name === "ma" ? "14-day avg" : "Weight",
                ]}
              />
              {weightGoal != null ? (
                <ReferenceLine
                  y={weightGoal}
                  stroke={COLORS.primary}
                  strokeDasharray="4 4"
                  label={{ value: `Goal ${weightGoal}`, fontSize: 10, fill: COLORS.primary, position: "insideTopRight" }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="weight"
                stroke={COLORS.green}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                name="Weight"
              />
              <Line
                type="monotone"
                dataKey="ma"
                stroke={COLORS.purple}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
                name="14-day avg"
              />
            </LineChart>
          </ResponsiveContainer>

          {stats ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <WeightStat label="First" date={stats.first.date} value={formatWeight(stats.first.value)} />
              <WeightStat label="Latest" date={stats.latest.date} value={formatWeight(stats.latest.value)} />
              <WeightStat label="Min" value={formatWeight(stats.min)} />
              <WeightStat label="Max" value={formatWeight(stats.max)} />
              <WeightStat
                label="Δ in range"
                value={formatWeightDelta(stats.delta)}
                tone={
                  Math.abs(stats.delta) < 0.05
                    ? "muted"
                    : weightGoal != null
                    ? Math.abs(Number(stats.latest.value) - weightGoal) <
                      Math.abs(Number(stats.first.value) - weightGoal)
                      ? "success"
                      : "warning"
                    : "muted"
                }
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function WeightStat({ label, value, date, tone }) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-base font-semibold tabular-nums", toneCls)}>{value}</p>
      {date ? <p className="text-[10px] text-muted-foreground">{prettyDate(date)}</p> : null}
    </div>
  );
}

// Compact per-slot card: label + total + sparkline. No axes / grid - the
// shape carries the story, exact daily values surface on hover via tooltip.
// Empty state (no reps in range) shows a dashed placeholder rather than a
// flat zero-line so the user doesn't confuse "untracked" with "logged a 0".
function MiniSparklineCard({ exercise, series, stats }) {
  const { total, max, daysActive } = stats;
  const target = exercise?.target ?? null;
  const daysAtTarget = useMemo(
    () => (target ? series.filter((d) => Number(d.value) >= target).length : null),
    [series, target]
  );
  const label = exercise?.label ?? "—";

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 p-3">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          No reps logged yet.
        </p>
        <div className="mt-3 h-12 rounded-md border border-dashed border-border/40" aria-hidden />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card/60 p-3">
      <div className="flex items-baseline justify-between gap-1.5">
        <p className="min-w-0 truncate text-xs font-medium" title={label}>{label}</p>
        {target ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            target {target}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums">
        {total.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {`reps · max ${max}/day · `}
        {target != null ? `${daysAtTarget} days hit target` : `${daysActive} active days`}
      </p>
      <div className="mt-2 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 11,
                padding: "4px 8px",
              }}
              labelFormatter={(_label, payload) => {
                const d = payload?.[0]?.payload?.date;
                return d ? prettyDate(d) : "";
              }}
              formatter={(v) => [v, "reps"]}
            />
            {target ? (
              <ReferenceLine y={target} stroke={COLORS.muted} strokeDasharray="2 2" />
            ) : null}
            <Area
              type="monotone"
              dataKey="value"
              stroke={COLORS.primary}
              fill={COLORS.primary}
              fillOpacity={0.2}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-card/70 p-4 shadow-paper-1 paper-texture transition-shadow hover:shadow-paper-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold leading-none tabular-nums">{value}</p>
    </div>
  );
}

function ChartCard({ icon: Icon, title, subtitle, srSummary, children }) {
  // role="img" + aria-label gives screen readers a single-sentence summary
  // of the chart's purpose instead of letting them try to walk the SVG.
  // recharts doesn't expose a clean text-alt API, so we wrap.
  // srSummary defaults to the visible subtitle when omitted — every chart
  // therefore has SOME alt-text, and authors can override with a more
  // numeric summary ("Average sleep this week: 7.2 hours, down from 7.5").
  return (
    <div
      className="rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture sm:p-6"
      role="img"
      aria-label={srSummary ? `${title}. ${srSummary}` : `${title}. ${subtitle}`}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold tracking-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// Local wrapper that adapts the shared EmptyState for compact in-chart
// placement (no icon, no body, just the Caveat handwritten line).
function EmptyState({ text }) {
  return (
    <SharedEmptyState title={text} compact className="h-32 border-border/50" />
  );
}

// Build the start-of-week date string for the week ending `to` (Monday of that week).
function addDaysStr(dateString, days) {
  const d = new Date(dateString + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function WeekCompare({ today }) {
  const thisMonday = weekStartStr();
  const lastMonday = addDaysStr(thisMonday, -7);
  const lastSunday = addDaysStr(thisMonday, -1);

  const [loading, setLoading] = useState(true);
  const [d, setD] = useState({ sessions: [], sleep: [], water: [], mood: [], cardio: [] });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      GlobalApi.GetSessions({ from: lastMonday, to: today }),
      GlobalApi.GetSleep({ from: lastMonday, to: today }),
      GlobalApi.GetWater({ from: lastMonday, to: today }),
      GlobalApi.GetMood({ from: lastMonday, to: today }),
      GlobalApi.GetCardio({ from: lastMonday, to: today }),
    ])
      .then(([s, sl, w, m, c]) => {
        setD({
          sessions: s.data ?? [],
          sleep: sl.data ?? [],
          water: w.data ?? [],
          mood: m.data ?? [],
          cardio: c.data ?? [],
        });
      })
      .finally(() => setLoading(false));
  }, [lastMonday, today]);

  const inRange = (row, from, to) => row.date >= from && row.date <= to;

  const stats = useMemo(() => {
    const f = (rows, from, to) => rows.filter((r) => inRange(r, from, to));
    const sessionsThis = f(d.sessions, thisMonday, today).filter(
      (s) => s.completed && s.planDayLabel !== "Rest"
    ).length;
    const sessionsLast = f(d.sessions, lastMonday, lastSunday).filter(
      (s) => s.completed && s.planDayLabel !== "Rest"
    ).length;
    const sleepAvg = (rows) => mean(rows.map((r) => (r.hours == null ? null : Number(r.hours))));
    const waterAvg = (rows) => mean(rows.map((r) => Number(r.totalMl ?? 0)).filter((v) => v > 0));
    const moodAvg = (rows) => mean(rows.map((r) => r.mood ?? null));
    const cardioSum = (rows) => rows.reduce((s, r) => s + (Number(r.durationMinutes) || 0), 0);
    return {
      sessions: { now: sessionsThis, prev: sessionsLast },
      sleep: {
        now: sleepAvg(f(d.sleep, thisMonday, today)),
        prev: sleepAvg(f(d.sleep, lastMonday, lastSunday)),
      },
      water: {
        now: waterAvg(f(d.water, thisMonday, today)),
        prev: waterAvg(f(d.water, lastMonday, lastSunday)),
      },
      mood: {
        now: moodAvg(f(d.mood, thisMonday, today)),
        prev: moodAvg(f(d.mood, lastMonday, lastSunday)),
      },
      cardio: {
        now: cardioSum(f(d.cardio, thisMonday, today)),
        prev: cardioSum(f(d.cardio, lastMonday, lastSunday)),
      },
    };
  }, [d, thisMonday, lastMonday, lastSunday, today]);

  return (
    <div className="rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">This week vs last week</p>
          <p className="text-xs text-muted-foreground">
            {prettyDate(thisMonday)} – today, compared to {prettyDate(lastMonday)} – {prettyDate(lastSunday)}.
          </p>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <CompareCard
            icon={Dumbbell}
            label="Workouts"
            now={stats.sessions.now}
            prev={stats.sessions.prev}
            format={(v) => `${v}`}
          />
          <CompareCard
            icon={Bed}
            label="Avg sleep"
            now={stats.sleep.now}
            prev={stats.sleep.prev}
            format={(v) => formatDuration(v)}
          />
          <CompareCard
            icon={Droplet}
            label="Avg water"
            now={stats.water.now}
            prev={stats.water.prev}
            format={(v) => formatWater(v)}
          />
          <CompareCard
            icon={Smile}
            label="Avg mood"
            now={stats.mood.now}
            prev={stats.mood.prev}
            format={(v) => formatScoreOf5(v)}
          />
          <CompareCard
            icon={Footprints}
            label="Cardio"
            now={stats.cardio.now}
            prev={stats.cardio.prev}
            format={(v) => `${Math.round(v)} min`}
          />
        </div>
      )}
    </div>
  );
}

function CompareCard({ icon: Icon, label, now, prev, format }) {
  const hasNow = now != null && !(typeof now === "number" && Number.isNaN(now));
  const hasPrev = prev != null && !(typeof prev === "number" && Number.isNaN(prev));
  const delta = hasNow && hasPrev ? Number(now) - Number(prev) : null;
  const trend = delta == null ? "flat" : delta > 0.01 ? "up" : delta < -0.01 ? "down" : "flat";
  const TrendIcon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const trendColor =
    trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums">
        {hasNow ? format(Number(now)) : "-"}
      </p>
      <div className={cn("mt-0.5 flex items-center gap-1 text-[11px]", trendColor)}>
        <TrendIcon className="h-3 w-3" />
        <span>
          last: {hasPrev ? format(Number(prev)) : "-"}
        </span>
      </div>
    </div>
  );
}
