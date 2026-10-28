"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  Plus,
  Minus,
  Settings as Cog,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import GlobalApi from "@/app/_services/GlobalApi";
import { DEFAULT_MINI_EXERCISES, normaliseMiniExercises } from "@/lib/mini";
import { etched } from "@/lib/etchFeedback";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The "Daily 4" - four configurable mini-workouts (default press-ups, squats,
// sit-ups, jumping jacks) ticked off daily regardless of any planned session.
// Counts toward the activity streak so a 30-second routine keeps the streak
// alive even on days you don't otherwise log anything.
//
// Props:
//   - todayRows: DAILY_MINI_LOGS rows for `today` (from dashboard.today.mini)
//   - configured: USER_CONTEXT.miniExercises - the four slot configs
//   - today:    YYYY-MM-DD - the date logs are written against
//   - onChanged(): trigger SWR mutate after save / config change
export default function MiniWorkoutsCard({ todayRows, configured, today, onChanged }) {
  const exercises = useMemo(
    () => (configured && configured.length === 4 ? configured : DEFAULT_MINI_EXERCISES),
    [configured]
  );

  // Map slot -> count from server rows. Used as the canonical "saved" value.
  const savedBySlot = useMemo(() => {
    const m = new Map();
    for (const r of todayRows ?? []) m.set(r.slot, Number(r.count) || 0);
    return m;
  }, [todayRows]);

  const totalReps = useMemo(
    () => Array.from(savedBySlot.values()).reduce((a, b) => a + b, 0),
    [savedBySlot]
  );
  const hitTargets = useMemo(() => {
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const target = exercises[i]?.target;
      if (!target) continue;
      const got = savedBySlot.get(i) ?? 0;
      if (got >= target) n += 1;
    }
    return n;
  }, [exercises, savedBySlot]);
  const totalTargets = exercises.filter((e) => e?.target).length;

  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Daily 4
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <p className="font-mono text-2xl font-bold leading-none tabular-nums">{totalReps}</p>
              <p className="text-xs text-muted-foreground">
                reps today
                {totalTargets > 0 ? (
                  <span className="ml-2 text-foreground/80">
                    · {hitTargets}/{totalTargets} targets hit
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            aria-label="Edit Daily 4"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Cog className="h-4 w-4" />
          </button>
          <Link
            href="/dashboard/me/trends"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Trends <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {exercises.map((ex, idx) => (
          <MiniTile
            key={`${idx}-${ex.key}`}
            slot={idx}
            exercise={ex}
            count={savedBySlot.get(idx) ?? 0}
            today={today}
            onChanged={onChanged}
          />
        ))}
      </ul>

      <ConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        exercises={exercises}
        onSaved={onChanged}
      />
    </div>
  );
}

function MiniTile({ slot, exercise, count, today, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(count));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(count));
  }, [count, editing]);

  const target = exercise.target ?? null;
  const hitTarget = target != null && count >= target;
  const hasReps = count > 0;
  const pct = target ? Math.min(100, Math.round((count / target) * 100)) : null;

  const save = async (newCount) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await GlobalApi.SaveMini({ date: today, slot, count: newCount });
      // Pass the saved row up so the parent can patch its SWR cache
      // immediately. Without this, the count flashes back to its old value
      // until the background refetch completes - same UX bug we just fixed
      // on the Meals tile.
      onChanged?.({ action: "mini-set", row: res?.data });
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const inc = (n) => {
    // Etched feedback per UX-PATTERNS.md §1 + §3: haptic + on-brand
    // toast with Undo. Closure captures the previous count so undo
    // reverts to exactly what was there before the tap.
    const previousCount = count;
    etched({
      message: `+${n} ${exercise.label.toLowerCase()} etched`,
      onUndo: () => save(previousCount),
    });
    save(Math.max(0, count + n));
  };
  const commitEdit = async () => {
    const n = Math.max(0, Math.floor(Number(draft) || 0));
    setEditing(false);
    if (n !== count) await save(n);
  };

  return (
    <li
      className={cn(
        "group relative rounded-xl border p-3 transition-colors",
        hitTarget
          ? "border-success/50 bg-success/5"
          : hasReps
          ? "border-primary/30 bg-primary/5"
          : "border-dashed border-border bg-transparent hover:border-primary/30"
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p
          className={cn(
            "min-w-0 truncate text-[11px] font-medium leading-tight",
            hasReps ? "text-foreground" : "text-muted-foreground"
          )}
          title={exercise.label}
        >
          {exercise.label}
        </p>
        {hitTarget ? (
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
            aria-label="Target hit"
          >
            <Check className="h-2.5 w-2.5" />
          </span>
        ) : null}
      </div>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commitEdit();
          }}
          className="mt-1.5 flex items-center gap-1"
        >
          <input
            type="number"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            min={0}
            aria-label={`${exercise.label} count`}
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-base font-bold tabular-nums outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(String(count));
            }}
            aria-label="Cancel"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-0.5 block w-full text-left font-mono text-2xl font-bold leading-none tabular-nums tracking-tight"
          aria-label={`Edit ${exercise.label} count, currently ${count}`}
        >
          {count}
          {target ? (
            <span className="ml-1 text-[11px] font-medium text-muted-foreground">
              / {target}
            </span>
          ) : null}
        </button>
      )}

      {target ? (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              hitTarget ? "bg-success" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => inc(1)}
          disabled={busy}
          className="rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => inc(10)}
          disabled={busy}
          className="rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
        >
          +10
        </button>
      </div>
      {count > 0 ? (
        <button
          type="button"
          onClick={() => save(0)}
          disabled={busy}
          className="mt-1 w-full rounded-md border border-dashed border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
        >
          Reset
        </button>
      ) : null}
    </li>
  );
}

function ConfigDialog({ open, onOpenChange, exercises, onSaved }) {
  const [draft, setDraft] = useState(() => exercises.map((e) => ({ ...e })));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(exercises.map((e) => ({ ...e })));
  }, [open, exercises]);

  const update = (i, patch) => {
    setDraft((s) => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    const normalised = normaliseMiniExercises(draft);
    setSaving(true);
    try {
      await GlobalApi.SaveUserContext({ miniExercises: normalised });
      toast.success("Daily 4 updated");
      onSaved?.();
      onOpenChange?.(false);
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit Daily 4</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Always four slots. Name each one; set a target only if you want a daily rep
          goal (the tile fills up and turns green when you hit it).
        </p>
        <div className="mt-3 space-y-3">
          {draft.map((row, i) => (
            <div key={i} className="space-y-1.5 rounded-md border bg-card/60 p-3">
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <div>
                  <Label htmlFor={`mini-label-${i}`}>Slot {i + 1}</Label>
                  <Input
                    id={`mini-label-${i}`}
                    value={row.label ?? ""}
                    onChange={(e) => update(i, { label: e.target.value })}
                    maxLength={30}
                  />
                </div>
                <div>
                  <Label htmlFor={`mini-target-${i}`}>Target</Label>
                  <Input
                    id={`mini-target-${i}`}
                    type="number"
                    min={0}
                    value={row.target ?? ""}
                    onChange={(e) => update(i, { target: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
