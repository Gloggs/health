"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Smile, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { todayDateStr, daysAgoStr, prettyDate } from "@/lib/dates";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHeader from "../../_components/PageHeader";
import EmptyState from "../../_components/states/EmptyState";

function safeDateParam(raw, today) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
}

const MOOD_LABELS = ["", "Awful", "Low", "OK", "Good", "Great"];
const ENERGY_LABELS = ["", "Empty", "Low", "OK", "Good", "Strong"];

function Scale({ value, onChange, label, labels }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n === value ? 0 : n)}
            aria-pressed={value === n}
            className={cn(
              "flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 transition-colors",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            <span className="font-mono text-[10px] font-medium tabular-nums opacity-70">
              {n}
            </span>
            <span className="text-[11px] font-semibold leading-none">
              {labels?.[n] ?? n}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MoodPage() {
  return (
    <Suspense fallback={null}>
      <MoodPageInner />
    </Suspense>
  );
}

function MoodPageInner() {
  const today = todayDateStr();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(() => safeDateParam(searchParams.get("date"), today));
  const [mood, setMood] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      GlobalApi.GetMood({ date }),
      GlobalApi.GetMood({ from: daysAgoStr(30), to: today }),
    ]).then(([cur, hist]) => {
      if (cur.data) {
        setMood(cur.data.mood ?? 0);
        setEnergy(cur.data.energy ?? 0);
        setNote(cur.data.note ?? "");
      } else {
        setMood(0); setEnergy(0); setNote("");
      }
      setHistory(hist.data ?? []);
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [date]);

  const save = async () => {
    setSaving(true);
    try {
      await GlobalApi.SaveMood({
        date,
        mood: mood || null,
        energy: energy || null,
        note: note.trim() || null,
      });
      toast.success("Saved");
      load();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        fallback="/dashboard/log"
        icon={Smile}
        title="Mood + energy"
        subtitle="How was today, really."
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

        <div className="space-y-4">
          <div>
            <Scale
              value={mood}
              onChange={setMood}
              label={`Mood ${mood ? `· ${MOOD_LABELS[mood]}` : ""}`}
              labels={MOOD_LABELS}
            />
          </div>
          <div>
            <Scale
              value={energy}
              onChange={setEnergy}
              label={`Energy ${energy ? `· ${ENERGY_LABELS[energy]}` : ""}`}
              labels={ENERGY_LABELS}
            />
          </div>
          <Input
            placeholder="Optional note"
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
                    Mood {h.mood ?? "-"}/5 · Energy {h.energy ?? "-"}/5
                    {h.note ? ` · ${h.note}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
