"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import GlobalApi from "@/app/_services/GlobalApi";
import { useLog } from "@/components/log/LogProvider";
import { formatDuration } from "@/lib/format";
import { cardioUsuals, defaultMealSlot, MEAL_SLOTS, normaliseContainers } from "@/lib/usuals";
import { cn } from "@/lib/utils";

const litres = (ml) => `${(ml / 1000).toFixed(2).replace(/\.?0+$/, "")} L`;
const SLEEP_WORDS = { 1: "awful", 2: "poor", 3: "okay", 4: "good", 5: "great" };
const MOOD_WORDS = { 1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great" };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * Today's logs as one list. Every row opens the same log sheet when tapped.
 * The button on the right repeats your usual in one tap, with Undo.
 * Read-only when viewing a relative's day.
 */
export default function TodayLogList({ today, sleep, water, body, cardio, cardioHistory, meals, mood, userCtx, readOnly = false }) {
  const { openLog, announce } = useLog();
  const containers = useMemo(() => normaliseContainers(userCtx?.waterContainers), [userCtx]);
  const goal = userCtx?.waterTargetMl || 2500;
  const totalMl = typeof water === "number" ? water : water?.totalMl ?? 0;
  const usualRun = useMemo(() => cardioUsuals(cardioHistory ?? [], 1)[0] ?? null, [cardioHistory]);
  const mealSlotsDone = new Set((meals ?? []).map((m) => m.slot));
  const nextSlot = (() => {
    const guess = defaultMealSlot(new Date().getHours());
    if (!mealSlotsDone.has(guess)) return guess;
    return MEAL_SLOTS.find((s) => s !== "snack" && !mealSlotsDone.has(s)) ?? "snack";
  })();
  const weighedToday = body?.date === today && body?.weightKg != null;

  const quickWater = async () => {
    const c = containers[0];
    const r = await GlobalApi.AddWater({ date: today, amountMl: c.ml });
    const id = r.data?.id;
    announce({ message: `Water, ${c.name.toLowerCase()} ${c.ml} ml saved`, undo: id ? () => GlobalApi.DeleteWater(id) : null });
  };
  const quickCardio = async () => {
    const r = await GlobalApi.AddCardio({ date: today, ...usualRun });
    const id = r.data?.id;
    announce({ message: `${usualRun.type}, ${usualRun.durationMinutes} min saved`, undo: id ? () => GlobalApi.DeleteCardio(id) : null });
  };

  const rows = [
    {
      key: "sleep",
      label: "Sleep",
      done: !!sleep?.hours,
      text: sleep?.hours ? `${formatDuration(Number(sleep.hours))}${sleep.quality ? `, ${SLEEP_WORDS[sleep.quality]}` : ""}` : "Not yet",
    },
    {
      key: "water",
      label: "Water",
      done: totalMl >= goal,
      text: `${litres(totalMl)} of ${litres(goal)}`,
      progress: Math.min(100, (totalMl / goal) * 100),
      quick: { label: `+ ${containers[0].name}`, run: quickWater },
    },
    {
      key: "weight",
      label: "Weight",
      done: weighedToday,
      text: weighedToday ? `${Number(body.weightKg).toFixed(1)} kg` : body?.weightKg != null ? `Last ${Number(body.weightKg).toFixed(1)} kg` : "Not yet",
    },
    {
      key: "cardio",
      label: "Cardio",
      done: (cardio ?? []).length > 0,
      text: (cardio ?? []).length
        ? (cardio ?? []).map((c) => `${c.type}, ${c.durationMinutes ?? "?"} min`).join(". ")
        : "Not yet",
      quick: usualRun && !(cardio ?? []).length ? { label: `+ ${usualRun.type} ${usualRun.durationMinutes}`, run: quickCardio } : null,
    },
    {
      key: "meal",
      label: "Meals",
      done: mealSlotsDone.has("breakfast") && mealSlotsDone.has("lunch") && mealSlotsDone.has("dinner"),
      text: mealSlotsDone.size ? MEAL_SLOTS.filter((s) => mealSlotsDone.has(s)).map(cap).join(", ") : "Not yet",
      quick: { label: `+ ${cap(nextSlot)}`, run: () => openLog("meal", { slot: nextSlot }) },
    },
    {
      key: "mood",
      label: "Mood",
      done: !!mood?.mood,
      text: mood?.mood ? `${MOOD_WORDS[mood.mood]}${Array.isArray(mood.tags) && mood.tags.length ? `, ${mood.tags.join(", ")}` : ""}` : "Not yet",
    },
  ];
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <section aria-labelledby="today-log" className="border border-border bg-card">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
        <h2 id="today-log" className="font-display text-xl font-bold uppercase">
          Log
        </h2>
        <span className="text-sm text-muted-foreground">
          {doneCount} of {rows.length} done
        </span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border last:border-b-0">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => openLog(r.key)}
              className="grid min-h-[60px] grid-cols-[24px_minmax(0,1fr)] items-center gap-3 px-4 py-2 text-left disabled:cursor-default"
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-[22px] w-[22px] items-center justify-center",
                  r.done ? "bg-brand-sky text-[#142B38]" : "border border-foreground"
                )}
              >
                {r.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-base font-semibold">
                  {r.label}
                  <span className="sr-only">{r.done ? ", done" : ", to do"}</span>
                </span>
                {r.progress != null ? (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-block h-1.5 w-24 bg-muted" aria-hidden>
                      <span className="block h-1.5 bg-harbour" style={{ width: `${r.progress}%` }} />
                    </span>
                    {r.text}
                  </span>
                ) : (
                  <span className="truncate text-sm text-muted-foreground">{r.text}</span>
                )}
              </span>
            </button>
            {r.quick && !readOnly ? (
              <button
                type="button"
                onClick={r.quick.run}
                className="mr-3 h-10 whitespace-nowrap border border-foreground bg-card px-3 text-sm font-semibold"
              >
                {r.quick.label}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
