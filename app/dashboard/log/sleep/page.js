"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Bed, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { todayDateStr, daysAgoStr, prettyDate } from "@/lib/dates";
import { formatDuration } from "@/lib/format";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHeader from "../../_components/PageHeader";
import EmptyState from "../../_components/states/EmptyState";

// Validates and clamps a candidate date string against today. Accepts only
// YYYY-MM-DD shape that's <= today; anything else falls back to today. Shared
// pattern: every log page seeds its date picker from ?date= so the Today
// calendar can deep-link straight into "edit that day".
function safeDateParam(raw, today) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
}

function hoursBetween(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return null;
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

export default function SleepPage() {
  return (
    <Suspense fallback={null}>
      <SleepPageInner />
    </Suspense>
  );
}

function SleepPageInner() {
  const today = todayDateStr();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(() => safeDateParam(searchParams.get("date"), today));
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [quality, setQuality] = useState(0);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState(null);
  const [saving, setSaving] = useState(false);
  // Set true when bedtime/wakeTime are seeded from a previous entry rather
  // than from an existing row for `date`. Lets the UI label the values
  // honestly ("yesterday's defaults") so the user knows they can override.
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const load = () => {
    Promise.all([
      GlobalApi.GetSleep({ date }),
      GlobalApi.GetSleep({ from: daysAgoStr(30), to: today }),
    ]).then(([cur, hist]) => {
      const histRows = hist.data ?? [];
      if (cur.data) {
        setBedtime(cur.data.bedtime ?? "");
        setWakeTime(cur.data.wakeTime ?? "");
        setQuality(cur.data.quality ?? 0);
        setNote(cur.data.note ?? "");
        setDefaultsApplied(false);
      } else {
        // Yesterday-as-default (UX-PATTERNS §2). Only pre-fill the
        // slow-changing values (bedtime, wake time); never quality or
        // note — those should always be a fresh decision so they don't
        // defeat the deliberate-attention mechanic.
        const prev = histRows[0] ?? null;
        if (prev && (prev.bedtime || prev.wakeTime)) {
          setBedtime(prev.bedtime ?? "");
          setWakeTime(prev.wakeTime ?? "");
          setDefaultsApplied(true);
        } else {
          setBedtime("");
          setWakeTime("");
          setDefaultsApplied(false);
        }
        setQuality(0);
        setNote("");
      }
      setHistory(histRows);
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [date]);

  const hours = useMemo(() => hoursBetween(bedtime, wakeTime), [bedtime, wakeTime]);

  const save = async () => {
    setSaving(true);
    try {
      await GlobalApi.SaveSleep({
        date,
        bedtime: bedtime || null,
        wakeTime: wakeTime || null,
        hours,
        quality: quality || null,
        note: note.trim() || null,
      });
      toast.success("Sleep saved");
      load();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await GlobalApi.DeleteSleep(id);
      toast.success("Removed");
      load();
    } catch {
      toast.error("Failed to remove");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        fallback="/dashboard/log"
        icon={Bed}
        title="Sleep"
        subtitle="Bedtime, wake time, quality."
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bedtime</label>
            <Input
              type="time"
              value={bedtime}
              onChange={(e) => {
                setBedtime(e.target.value);
                setDefaultsApplied(false);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Wake time</label>
            <Input
              type="time"
              value={wakeTime}
              onChange={(e) => {
                setWakeTime(e.target.value);
                setDefaultsApplied(false);
              }}
            />
          </div>
        </div>

        {defaultsApplied ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Pre-filled from your last sleep log. Tap either field to adjust
            before saving.
          </p>
        ) : null}

        {hours !== null && (
          <p className="mt-3 text-sm text-muted-foreground">
            That's <span className="font-semibold tabular-nums text-foreground">{hours}h</span> of sleep.
          </p>
        )}

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Quality</p>
          {/* Descriptive labels per SURFACES.md §2 — picking a word is
              quicker than picking a number on the first tap, and forces
              the moment of reflection §2 calls out. The underlying value
              stays 1-5 so existing charts and exports don't break. */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {[
              { n: 1, label: "Rough" },
              { n: 2, label: "Okay" },
              { n: 3, label: "Good" },
              { n: 4, label: "Great" },
              { n: 5, label: "PB" },
            ].map(({ n, label }) => (
              <button
                key={n}
                onClick={() => setQuality(n === quality ? 0 : n)}
                aria-pressed={quality === n}
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 transition-colors",
                  quality === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <span className="font-mono text-[10px] font-medium tabular-nums opacity-70">
                  {n}
                </span>
                <span className="text-[11px] font-semibold leading-none">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Input
            placeholder="Optional note (woke up at 3am, dreams, etc.)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Last 30 days</p>
        {history === null ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : history.length === 0 ? (
          <EmptyState compact title="nothing logged yet" />
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{prettyDate(h.date)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.hours ? formatDuration(h.hours) : "-"}
                    {h.bedtime ? ` · ${h.bedtime}` : ""}
                    {h.wakeTime ? ` → ${h.wakeTime}` : ""}
                    {h.quality ? ` · quality ${h.quality} / 5` : ""}
                  </p>
                </div>
                <button
                  onClick={() => remove(h.id)}
                  className="text-destructive transition-colors hover:underline"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
