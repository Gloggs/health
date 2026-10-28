"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Trophy,
  Slash,
  RotateCcw,
  Check,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPlanTargets, isCardio } from "@/lib/planTargets";

// One exercise row in today's session. Collapsible to reveal logging.
//
// Strength rows now drive a "planned-set checklist" when the plan supplies
// `targetSets`: one row per planned set, pre-filled with target reps/weight
// and editable inline. Tick a row to log it (with whatever you actually did),
// or hit "Mark all done as prescribed" to bulk-log the unticked ones.
//
// The legacy free-form "Add set" form is preserved for exercises with no
// targetSets and for logging extra sets beyond the prescribed count.
//
// Cardio rows show a single "Done" button that logs target duration +
// distance once - the per-set concept doesn't apply.
//
// Props:
//   pe              - plan_exercises row with target fields + exercise name
//   sets            - logged session_sets for this exercise
//   previousMax     - lifetime best weight (strength only)
//   skipped         - skip toggle state from parent
//   disabled        - session locked (completed)
//   onLogSet({ setNumber, reps, weight })   - log a single set
//   onBulkLogSets([{ setNumber, reps, weight }])  - bulk-log multiple in one round trip
//   onRemoveSet(id) - delete a logged set
//   onToggleSkip()  - flip skipped state
export default function ExerciseRow({
  pe,
  sets,
  previousMax,
  skipped,
  disabled,
  onLogSet,
  onBulkLogSets,
  onRemoveSet,
  onToggleSkip,
}) {
  const cardio = isCardio(pe);
  const [expanded, setExpanded] = useState(!skipped);

  useEffect(() => {
    setExpanded(!skipped);
  }, [skipped]);

  const orderedSets = useMemo(
    () => [...sets].sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0)),
    [sets]
  );
  const setByNumber = useMemo(() => {
    const m = new Map();
    for (const s of orderedSets) m.set(s.setNumber, s);
    return m;
  }, [orderedSets]);
  const currentMax = useMemo(() => {
    if (cardio) return 0;
    let m = 0;
    for (const s of orderedSets) {
      const w = s.weight == null ? 0 : Number(s.weight);
      if (w > m) m = w;
    }
    return m;
  }, [orderedSets, cardio]);
  const isPR =
    !cardio && currentMax > 0 && previousMax != null && currentMax >= Number(previousMax);

  // ============================================================
  // STRENGTH: per-set checklist driven by targetSets
  // ============================================================
  const targetSets = !cardio && Number(pe.targetSets) > 0 ? Number(pe.targetSets) : 0;
  const plannedNumbers = useMemo(
    () => (targetSets > 0 ? Array.from({ length: targetSets }, (_, i) => i + 1) : []),
    [targetSets]
  );

  // Per-set draft (reps/weight) keyed by setNumber. Initialised from target
  // values; once a set is logged, the draft tracks the logged values so the
  // row keeps showing what you actually did.
  const initDraft = (n) => {
    const logged = setByNumber.get(n);
    if (logged) {
      return {
        reps: logged.reps == null ? "" : String(logged.reps),
        weight: logged.weight == null ? "" : String(logged.weight),
      };
    }
    return {
      reps: pe.targetReps ? String(pe.targetReps) : "",
      weight: pe.targetWeight ? String(pe.targetWeight) : "",
    };
  };
  const [draft, setDraft] = useState({});
  // Re-seed the draft whenever the plan target or logged sets change. Wrapped
  // in a ref-style check so editing a single field doesn't get clobbered by
  // unrelated re-renders.
  useEffect(() => {
    if (targetSets === 0) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const n of plannedNumbers) {
        if (!(n in next)) next[n] = initDraft(n);
        else {
          const logged = setByNumber.get(n);
          // If the row just got logged, sync the draft to the logged values
          // so editing later starts from what we have.
          if (logged) {
            next[n] = {
              reps: logged.reps == null ? next[n].reps : String(logged.reps),
              weight: logged.weight == null ? next[n].weight : String(logged.weight),
            };
          }
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSets, pe.targetReps, pe.targetWeight, orderedSets.length]);

  const tickPlannedSet = (n) => {
    if (disabled) return;
    if (setByNumber.has(n)) return; // already logged
    const d = draft[n] ?? initDraft(n);
    const reps = d.reps ? Number(d.reps) : null;
    const weight = d.weight ? Number(d.weight) : null;
    if (!reps && !weight) return;
    onLogSet?.({ setNumber: n, reps, weight });
  };

  const markAllDone = () => {
    if (disabled) return;
    const toLog = [];
    for (const n of plannedNumbers) {
      if (setByNumber.has(n)) continue;
      const d = draft[n] ?? initDraft(n);
      const reps = d.reps ? Number(d.reps) : null;
      const weight = d.weight ? Number(d.weight) : null;
      // Skip rows where the user cleared both fields - they're explicitly
      // saying "I didn't do this set."
      if (!reps && !weight) continue;
      toLog.push({ setNumber: n, reps, weight });
    }
    if (toLog.length === 0) return;
    if (onBulkLogSets) onBulkLogSets(toLog);
    else for (const s of toLog) onLogSet?.(s);
  };

  const unloggedPlannedCount = plannedNumbers.filter((n) => !setByNumber.has(n)).length;
  const allTargetDone = targetSets > 0 && unloggedPlannedCount === 0;

  // ============================================================
  // EXTRA sets / no-target free-form form (used when targetSets=0
  // or for sets beyond the prescribed count)
  // ============================================================
  const extraSets = useMemo(
    () => (targetSets > 0 ? orderedSets.filter((s) => s.setNumber > targetSets) : orderedSets),
    [orderedSets, targetSets]
  );
  const nextExtraSetNumber = targetSets > 0
    ? Math.max(targetSets, ...orderedSets.map((s) => s.setNumber ?? 0)) + 1
    : (orderedSets[orderedSets.length - 1]?.setNumber ?? 0) + 1;

  const [extraReps, setExtraReps] = useState(
    cardio
      ? pe.targetDurationMinutes ? String(pe.targetDurationMinutes) : ""
      : pe.targetReps ? String(pe.targetReps) : ""
  );
  const [extraWeight, setExtraWeight] = useState(
    cardio
      ? pe.targetDistanceKm ? String(pe.targetDistanceKm) : ""
      : pe.targetWeight ? String(pe.targetWeight) : ""
  );

  const submitExtra = (e) => {
    e?.preventDefault?.();
    const r = extraReps ? Number(extraReps) : null;
    const w = extraWeight ? Number(extraWeight) : null;
    if (!r && !w) return;
    onLogSet?.({ setNumber: nextExtraSetNumber, reps: r, weight: w });
  };

  // For cardio, "Done" = log the planned duration + distance as set 1.
  const cardioDone = () => {
    if (disabled || !cardio) return;
    const r = extraReps ? Number(extraReps) : null;
    const w = extraWeight ? Number(extraWeight) : null;
    if (!r && !w) return;
    onLogSet?.({ setNumber: 1, reps: r, weight: w });
  };

  // Status badge in the row header
  const statusBadge = (() => {
    if (orderedSets.length === 0) return null;
    if (cardio) return "Done";
    if (targetSets > 0) return `${Math.min(orderedSets.length, targetSets)}/${targetSets}${orderedSets.length > targetSets ? "+" : ""}`;
    return `${orderedSets.length} set${orderedSets.length === 1 ? "" : "s"}`;
  })();

  return (
    <li
      className={cn(
        "rounded-xl border bg-card p-3 transition-opacity",
        skipped && "opacity-50",
        allTargetDone && !skipped && "border-success/40"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          aria-label={expanded ? "Collapse exercise" : "Expand exercise"}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("truncate text-sm font-medium", skipped && "line-through")}>
              {pe.name}
            </p>
            {statusBadge ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  allTargetDone
                    ? "bg-success/15 text-success"
                    : "bg-primary/15 text-primary"
                )}
              >
                {statusBadge}
              </span>
            ) : null}
            {isPR ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                <Trophy className="h-3 w-3" /> PR
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {pe.muscleGroup}
            {formatPlanTargets(pe)}
            {!cardio && previousMax != null && previousMax > 0 ? ` · best ${previousMax}kg` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleSkip}
          aria-pressed={!!skipped}
          aria-label={skipped ? "Un-skip exercise" : "Skip exercise"}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {skipped ? <RotateCcw className="h-3.5 w-3.5" /> : <Slash className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && !skipped ? (
        <div className="mt-3 space-y-2 border-t pt-3">
          {pe.notes ? (
            <p className="rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              {pe.notes}
            </p>
          ) : null}

          {/* === STRENGTH with prescribed targetSets: per-set checklist === */}
          {!cardio && targetSets > 0 ? (
            <>
              <ul className="space-y-1">
                {plannedNumbers.map((n) => {
                  const logged = setByNumber.get(n);
                  const d = draft[n] ?? initDraft(n);
                  if (logged) {
                    return (
                      <li
                        key={n}
                        className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 px-2 py-1.5 text-xs"
                      >
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                          <Check className="h-3 w-3" />
                        </span>
                        <span className="flex-1 font-medium tabular-nums text-foreground/90">
                          Set {n}: {logged.reps ?? "?"} × {logged.weight ?? "?"}kg
                        </span>
                        {disabled ? null : (
                          <button
                            type="button"
                            onClick={() => onRemoveSet?.(logged.id)}
                            aria-label={`Un-log set ${n}`}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  }
                  // Unlogged planned set: editable fields + tick button
                  return (
                    <li
                      key={n}
                      className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs"
                    >
                      <span className="w-10 shrink-0 text-[11px] font-medium text-muted-foreground">
                        Set {n}
                      </span>
                      <input
                        type="number"
                        value={d.reps}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, [n]: { ...s[n], reps: e.target.value } }))
                        }
                        placeholder="reps"
                        min={0}
                        aria-label={`Set ${n} reps`}
                        disabled={disabled}
                        className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-60"
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                      <input
                        type="number"
                        step="0.5"
                        value={d.weight}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, [n]: { ...s[n], weight: e.target.value } }))
                        }
                        placeholder="kg"
                        min={0}
                        aria-label={`Set ${n} weight in kg`}
                        disabled={disabled}
                        className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => tickPlannedSet(n)}
                        disabled={disabled || (!d.reps && !d.weight)}
                        aria-label={`Log set ${n}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/40 text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {!disabled && unloggedPlannedCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllDone}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark {unloggedPlannedCount === plannedNumbers.length ? "all" : `remaining ${unloggedPlannedCount}`} done
                </button>
              ) : null}

              {extraSets.length > 0 ? (
                <ul className="space-y-1">
                  {extraSets.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-2 py-1.5 text-xs"
                    >
                      <span className="rounded-full bg-warning/20 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-warning">
                        Extra
                      </span>
                      <span className="flex-1 font-medium tabular-nums">
                        Set {s.setNumber}: {s.reps ?? "?"} × {s.weight ?? "?"}kg
                      </span>
                      {disabled ? null : (
                        <button
                          type="button"
                          onClick={() => onRemoveSet?.(s.id)}
                          aria-label="Remove extra set"
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}

              {!disabled ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                    + Add extra set beyond plan
                  </summary>
                  <form onSubmit={submitExtra} className="mt-2 flex items-center gap-1.5">
                    <input
                      type="number"
                      value={extraReps}
                      onChange={(e) => setExtraReps(e.target.value)}
                      placeholder="reps"
                      min={1}
                      aria-label="Extra set reps"
                      className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <input
                      type="number"
                      step="0.5"
                      value={extraWeight}
                      onChange={(e) => setExtraWeight(e.target.value)}
                      placeholder="kg"
                      min={0}
                      aria-label="Extra set weight in kg"
                      className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Plus className="h-3 w-3" /> Set {nextExtraSetNumber}
                    </button>
                  </form>
                </details>
              ) : null}
            </>
          ) : null}

          {/* === CARDIO: single "Done" button === */}
          {cardio ? (
            <>
              {orderedSets.length > 0 ? (
                <ul className="space-y-1">
                  {orderedSets.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-md border border-success/40 bg-success/5 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium tabular-nums">
                        {s.reps ?? "?"} min{s.weight ? ` · ${s.weight} km` : ""}
                      </span>
                      {disabled ? null : (
                        <button
                          type="button"
                          onClick={() => onRemoveSet?.(s.id)}
                          aria-label="Remove cardio entry"
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}

              {!disabled ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={extraReps}
                    onChange={(e) => setExtraReps(e.target.value)}
                    placeholder="min"
                    min={1}
                    aria-label="Duration in minutes"
                    className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  />
                  <span className="text-xs text-muted-foreground">·</span>
                  <input
                    type="number"
                    step="0.1"
                    value={extraWeight}
                    onChange={(e) => setExtraWeight(e.target.value)}
                    placeholder="km"
                    min={0}
                    aria-label="Distance in km"
                    className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={cardioDone}
                    disabled={!extraReps && !extraWeight}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Check className="h-3 w-3" />
                    Done
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {/* === STRENGTH without targetSets: legacy free-form add === */}
          {!cardio && targetSets === 0 ? (
            <>
              {orderedSets.length > 0 ? (
                <ul className="space-y-1">
                  {orderedSets.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium tabular-nums">
                        Set {s.setNumber}: {s.reps ?? "?"} × {s.weight ?? "?"}kg
                      </span>
                      {disabled ? null : (
                        <button
                          type="button"
                          onClick={() => onRemoveSet?.(s.id)}
                          aria-label="Remove set"
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}

              {!disabled ? (
                <form onSubmit={submitExtra} className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={extraReps}
                    onChange={(e) => setExtraReps(e.target.value)}
                    placeholder="reps"
                    min={1}
                    aria-label="Reps"
                    className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <input
                    type="number"
                    step="0.5"
                    value={extraWeight}
                    onChange={(e) => setExtraWeight(e.target.value)}
                    placeholder="kg"
                    min={0}
                    aria-label="Weight in kg"
                    className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Plus className="h-3 w-3" /> Set {nextExtraSetNumber}
                  </button>
                </form>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
