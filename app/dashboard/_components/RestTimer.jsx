"use client";

import { useEffect, useState } from "react";
import { Timer, FastForward, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [60, 90, 120, 180];

// Floating rest-period indicator. Mounted in TodayPage; shown when `endsAt`
// is a future timestamp. Ticks every 250ms so the countdown stays smooth.
//
// Props:
//   - endsAt: epoch-ms when the rest period ends, or null when idle
//   - seconds: current rest preset (so the user can see what they chose)
//   - onSkip: cancel the active rest
//   - onChangeSeconds(s): persist a new preset (parent stores in localStorage)
export default function RestTimer({ endsAt, seconds, onSkip, onChangeSeconds }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return null;

  const remainingMs = Math.max(0, endsAt - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const totalSec = Math.max(1, seconds || 90);
  const pct = Math.max(0, Math.min(100, (remainingMs / (totalSec * 1000)) * 100));
  const done = remainingMs <= 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl shadow-paper-2 transition-colors",
          done ? "border-success/40" : "border-border"
        )}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              done ? "bg-success/15 text-success" : "bg-primary/15 text-primary"
            )}
          >
            <Timer className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {done ? "Rest over" : "Resting"}
            </p>
            <p className="text-xl font-bold tabular-nums">
              {mm}:{String(ss).padStart(2, "0")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <select
              value={String(seconds)}
              onChange={(e) => onChangeSeconds?.(Number(e.target.value))}
              aria-label="Rest preset"
              className="rounded-md border bg-background px-1.5 py-1 text-[11px] font-medium outline-none focus:border-primary"
            >
              {PRESETS.map((s) => (
                <option key={s} value={s}>
                  {s}s
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSkip}
              aria-label={done ? "Dismiss" : "Skip rest"}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {done ? <X className="h-3 w-3" /> : <FastForward className="h-3 w-3" />}
              {done ? "Close" : "Skip"}
            </button>
          </div>
        </div>
        <div className="h-1 bg-muted">
          <div
            className={cn("h-full transition-all duration-200", done ? "bg-success" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
