"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Droplet, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { todayDateStr, daysAgoStr, prettyDate } from "@/lib/dates";
import { formatMl, formatWater } from "@/lib/format";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHeader from "../../_components/PageHeader";
import EmptyState from "../../_components/states/EmptyState";

const DEFAULT_TARGET_ML = 2500;

function safeDateParam(raw, today) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
}

export default function WaterPage() {
  return (
    <Suspense fallback={null}>
      <WaterPageInner />
    </Suspense>
  );
}

function WaterPageInner() {
  const today = todayDateStr();
  const searchParams = useSearchParams();
  // `date` selects which day we read/write. Defaults to today; calendar
  // links land here with ?date=YYYY-MM-DD to edit a past day's intake.
  const [date, setDate] = useState(() => safeDateParam(searchParams.get("date"), today));
  const [dayData, setDayData] = useState(null);
  const [history, setHistory] = useState(null);
  const [custom, setCustom] = useState("");
  const [targetMl, setTargetMl] = useState(DEFAULT_TARGET_ML);
  const isToday = date === today;

  const load = () => {
    Promise.all([
      GlobalApi.GetWater({ date }),
      GlobalApi.GetWater({ from: daysAgoStr(13), to: today }),
      GlobalApi.GetUserContext().catch(() => ({ data: null })),
    ]).then(([d, h, ctx]) => {
      setDayData(d.data);
      setHistory(h.data ?? []);
      const v = Number(ctx?.data?.waterTargetMl);
      setTargetMl(v && v > 0 ? v : DEFAULT_TARGET_ML);
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [date]);

  const add = async (ml) => {
    if (!ml || ml <= 0) return;
    try {
      await GlobalApi.AddWater({ date, amountMl: ml });
      load();
    } catch {
      toast.error("Failed to add");
    }
  };

  const remove = async (id) => {
    try {
      await GlobalApi.DeleteWater(id);
      load();
    } catch {
      toast.error("Failed to remove");
    }
  };

  const submitCustom = () => {
    const n = Number(custom);
    if (!n || n <= 0) return;
    add(n);
    setCustom("");
  };

  const total = dayData?.totalMl ?? 0;
  // Mirror the Today tile's 150% bar so the user can see over-target intake
  // here too. Goal mark sits at 2/3 of bar width.
  const BAR_CAP_PCT = 150;
  const rawPct = Math.round((total / targetMl) * 100);
  const fillPct = Math.min(BAR_CAP_PCT, Math.max(0, rawPct));
  const fillWidth = (fillPct / BAR_CAP_PCT) * 100;
  const overMl = total - targetMl;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        fallback="/dashboard/log"
        icon={Droplet}
        title="Water"
        subtitle={`Tap to add. Target ${formatMl(targetMl)}, change it in Settings → Goals.`}
      />

      <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Log for</p>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {isToday ? "Today" : prettyDate(date)}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums">{total.toLocaleString("en-GB")} <span className="text-base font-medium text-muted-foreground">ml</span></p>
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">
            {rawPct}% of target
            {overMl > 0 ? <span className="ml-1 font-medium text-success">+{formatMl(overMl)}</span> : null}
          </p>
        </div>
        <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              total >= targetMl ? "bg-success" : "bg-primary"
            }`}
            style={{ width: `${fillWidth}%` }}
          />
          <div
            aria-hidden
            title={`Goal: ${formatMl(targetMl)}`}
            className="absolute inset-y-0 w-0.5 bg-foreground/70"
            style={{ left: `calc(${100 / 1.5}% - 1px)` }}
          />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[250, 500, 750].map((ml) => (
            <Button key={ml} variant="outline" onClick={() => add(ml)}>
              <Plus className="mr-1 h-4 w-4" /> {ml} ml
            </Button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            type="number"
            placeholder="Custom ml"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            min={1}
          />
          <Button onClick={submitCustom}>Save</Button>
        </div>

        {dayData?.entries?.length ? (
          <button
            onClick={() => remove(dayData.entries[0].id)}
            className="mt-3 w-full rounded-lg border border-dashed border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
          >
            Undo last ({formatMl(dayData.entries[0].amountMl)})
          </button>
        ) : null}

        {dayData?.entries?.length ? (
          <div className="mt-5 space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {isToday ? "Today's entries" : "Entries on this day"}
            </p>
            {dayData.entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs"
              >
                <span className="tabular-nums">{formatMl(e.amountMl)}</span>
                <button
                  onClick={() => remove(e.id)}
                  className="text-destructive transition-colors hover:underline"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Last 14 days</p>
        {history === null ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : history.length === 0 ? (
          <EmptyState compact title="nothing logged yet" />
        ) : (
          <div className="flex items-end gap-1.5 overflow-x-auto">
            {history
              .slice()
              .reverse()
              .map((d) => {
                const dayPct = Math.min(100, Math.round((Number(d.totalMl) / targetMl) * 100));
                return (
                  <div key={d.date} className="flex w-7 shrink-0 flex-col items-center gap-1">
                    <div
                      className="w-full overflow-hidden rounded-md bg-muted"
                      style={{ height: 80 }}
                      title={`${prettyDate(d.date)}: ${formatMl(d.totalMl)}`}
                    >
                      <div
                        className="bg-primary"
                        style={{ height: `${dayPct}%`, marginTop: `${100 - dayPct}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground">
                      {prettyDate(d.date).split(" ")[1]}
                    </p>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
