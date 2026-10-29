"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Bed,
  Droplet,
  Smile,
  Footprints,
  Scale,
  UtensilsCrossed,
  Activity,
  Pencil,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { prettyDate, dateStr } from "@/lib/dates";
import {
  formatDuration,
  formatMl,
  formatMinutes,
  formatWeight,
  formatCount,
  pluralize,
} from "@/lib/format";

// Month-view replacement for the 16-week heat map. Renders a Mon-Sun calendar
// grid for the visible month with previous/next navigation. Day cells colour
// by activity and open a popover with the day's summary (same data source the
// heat map used).
//
// Props:
//   - sessions: Set of YYYY-MM-DD strings the user trained on
//   - getDaySummary(dateStr): returns the per-day rollup or null
//   - earliest (optional): YYYY-MM-DD - clamps the "previous month" button
export default function MonthCalendar({ sessions, getDaySummary, earliest }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  // Build the grid: Mon-first week, empty cells for days before the 1st, then
  // the dates of the month. We always render whole weeks (multiple of 7) so
  // the grid height stays stable.
  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = last.getDate();
    // Mon=0..Sun=6
    const startOffset = (first.getDay() + 6) % 7;

    const out = [];
    for (let i = 0; i < startOffset; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      const ds = dateStr(dt);
      out.push({
        date: ds,
        day: d,
        isToday: dt.getTime() === today.getTime(),
        future: dt > today,
        active: sessions.has(ds),
      });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewYear, viewMonth, sessions, today]);

  const activeInMonth = useMemo(
    () => cells.filter((c) => c && c.active).length,
    [cells]
  );

  const prev = () => {
    const m = viewMonth - 1;
    if (m < 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m);
    }
  };
  const next = () => {
    const m = viewMonth + 1;
    if (m > 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m);
    }
  };

  // Don't let users wander indefinitely into the future. Cap at the current month.
  const atCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();
  // Soft floor: if `earliest` is given, disable prev when we've reached its month.
  const atEarliest = useMemo(() => {
    if (!earliest) return false;
    const e = new Date(earliest + "T00:00:00");
    return viewYear < e.getFullYear() ||
      (viewYear === e.getFullYear() && viewMonth <= e.getMonth());
  }, [earliest, viewYear, viewMonth]);

  const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={prev}
          disabled={atEarliest}
          aria-label="Previous month"
          className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-base font-semibold tabular-nums">{monthName}</p>
        <button
          type="button"
          onClick={next}
          disabled={atCurrentMonth}
          aria-label="Next month"
          className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center">
        {DAY_LETTERS.map((d, i) => (
          <span key={i} className="text-xs font-medium text-muted-foreground">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={`pad-${i}`} className="h-10" />;
          return (
            <DayCell
              key={c.date}
              cell={c}
              summary={getDaySummary ? getDaySummary(c.date) : null}
            />
          );
        })}
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {activeInMonth} {activeInMonth === 1 ? "day" : "days"} with something logged. Tap a day to see it.
      </p>
    </div>
  );
}

function cellClass(cell) {
  return cn(
    "flex h-10 w-full items-center justify-center text-sm tabular-nums",
    cell.future
      ? "text-muted-foreground/50"
      : cell.active
      ? "bg-brand-sky font-bold text-ink"
      : "border border-border text-muted-foreground",
    cell.isToday && "border-2 border-flame font-bold"
  );
}

function DayCell({ cell, summary }) {
  if (cell.future) {
    return <div className={cellClass(cell)}>{cell.day}</div>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Activity on ${cell.date}`}
          className={cellClass(cell) + " cursor-pointer"}
        >
          {cell.day}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="center">
        <DaySummary date={cell.date} summary={summary} />
      </PopoverContent>
    </Popover>
  );
}

// All log modules that support past-day editing via ?date=YYYY-MM-DD.
// The grid order here is the order they appear in the popover edit row.
const EDIT_TARGETS = [
  { key: "sleep", icon: Bed, href: "/dashboard/log/sleep", label: "Sleep" },
  { key: "water", icon: Droplet, href: "/dashboard/log/water", label: "Water" },
  { key: "mood", icon: Smile, href: "/dashboard/log/mood", label: "Mood" },
  { key: "body", icon: Scale, href: "/dashboard/log/body", label: "Weight" },
  { key: "cardio", icon: Footprints, href: "/dashboard/log/cardio", label: "Cardio" },
  { key: "meals", icon: UtensilsCrossed, href: "/dashboard/log/meals", label: "Meals" },
];

function DaySummary({ date, summary }) {
  const items = [];
  if (summary?.session) items.push({ icon: Dumbbell, text: "Workout logged" });
  if (summary?.sleepH != null) {
    const q = summary.sleepQ ? ` · Q ${summary.sleepQ} / 5` : "";
    items.push({ icon: Bed, text: `${formatDuration(summary.sleepH)} sleep${q}` });
  }
  if (summary?.waterMl) items.push({ icon: Droplet, text: `${formatMl(summary.waterMl)} water` });
  if (summary?.mood) items.push({ icon: Smile, text: `Mood ${summary.mood} / 5` });
  if (summary?.cardioMin) items.push({ icon: Footprints, text: `${formatMinutes(summary.cardioMin)} cardio` });
  if (summary?.weightKg) items.push({ icon: Scale, text: formatWeight(summary.weightKg) });
  if (summary?.mealsCount) {
    const junkSuffix = summary.mealsJunk ? ` (${summary.mealsJunk} junk)` : "";
    items.push({
      icon: UtensilsCrossed,
      text: `${pluralize(summary.mealsCount, "meal", "meals")}${junkSuffix}`,
    });
  }
  if (summary?.miniReps) {
    items.push({ icon: Activity, text: `${formatCount(summary.miniReps)} mini reps` });
  }
  return (
    <div>
      <p className="text-xs font-semibold">{prettyDate(date)}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nothing logged.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Past-day editor entry points: each log module accepts ?date= so the
          calendar popover can deep-link straight into the relevant editor. */}
      <div className="mt-3 border-t pt-2">
        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Pencil className="h-3 w-3" /> Edit this day
        </p>
        <div className="grid grid-cols-3 gap-1">
          {EDIT_TARGETS.map(({ key, icon: Icon, href, label }) => (
            <Link
              key={key}
              href={`${href}?date=${date}`}
              className="flex flex-col items-center gap-1 rounded-md border border-border/60 bg-card px-1 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
