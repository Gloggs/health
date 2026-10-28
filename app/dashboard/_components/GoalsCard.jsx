"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Target, Plus, Trash2, Pencil, Trophy, Scale, Sparkles, UtensilsCrossed } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import GlobalApi from "@/app/_services/GlobalApi";
import EmptyState from "./states/EmptyState";

const KIND_META = {
  lift: { icon: Trophy, label: "Lift" },
  weight: { icon: Scale, label: "Body weight" },
  "junk-limit": { icon: UtensilsCrossed, label: "Junk limit" },
  custom: { icon: Sparkles, label: "Custom" },
};

// Self-contained card. Fetches goals + (lazily) exercises, manages add/edit/delete
// state in-component, and pushes back via GlobalApi.
export default function GoalsCard() {
  const [goals, setGoals] = useState(null);
  const [exercises, setExercises] = useState(null);
  const [editing, setEditing] = useState(null); // null | "new" | goal object

  const load = () => GlobalApi.ListGoals().then((r) => setGoals(r.data ?? []));
  useEffect(() => {
    load();
  }, []);

  const ensureExercises = async () => {
    if (exercises) return exercises;
    const r = await GlobalApi.ListExercises();
    const list = r.data ?? [];
    setExercises(list);
    return list;
  };

  const remove = async (id) => {
    try {
      await GlobalApi.DeleteGoal(id);
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Goals</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await ensureExercises();
            setEditing("new");
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add goal
        </Button>
      </div>

      {goals === null ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : goals.length === 0 ? (
        <EmptyState
          compact
          title="no goals yet"
          body='Add one, "Bench 100kg" or "Weigh 75kg", to track progress here.'
        />
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => (
            <GoalRow
              key={g.id}
              goal={g}
              onEdit={async () => {
                await ensureExercises();
                setEditing(g);
              }}
              onDelete={() => remove(g.id)}
            />
          ))}
        </ul>
      )}

      <GoalDialog
        open={editing !== null}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        goal={editing === "new" ? null : editing}
        exercises={exercises ?? []}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </div>
  );
}

function GoalRow({ goal, onEdit, onDelete }) {
  const { icon: Icon } = KIND_META[goal.kind] ?? KIND_META.custom;
  const subtitle = useMemo(() => buildSubtitle(goal), [goal]);
  const isJunk = goal.kind === "junk-limit";

  const progressPct = useMemo(() => {
    if (goal.kind === "weight" && goal.current != null && goal.targetValue != null) {
      const start = Math.abs(Number(goal.targetValue) - Number(goal.current));
      const within = Math.max(0, 5 - start) / 5;
      return Math.round(within * 100);
    }
    if (goal.progress01 == null) return null;
    return Math.round(goal.progress01 * 100);
  }, [goal]);

  // For lift goals, hitting target = win. For junk-limit, staying UNDER = win;
  // overshooting flips the bar to destructive.
  const hit = goal.kind === "lift" && goal.progress01 != null && goal.progress01 >= 1;
  const overLimit = isJunk && goal.progress01 != null && goal.progress01 > 1;
  const junkOk = isJunk && goal.progress01 != null && goal.progress01 <= 1;
  const iconTone =
    hit || junkOk ? "bg-success/15 text-success" : overLimit ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary";
  const barTone =
    hit || junkOk ? "bg-success" : overLimit ? "bg-destructive" : "bg-primary";

  return (
    <li className="rounded-xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              iconTone
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{goal.description}</p>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {progressPct != null ? (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full transition-all", barTone)}
              style={{ width: Math.min(100, progressPct) + "%" }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {goal.kind === "weight"
              ? `now ${goal.current ?? "-"}${goal.targetUnit ?? "kg"} → target ${goal.targetValue}${goal.targetUnit ?? "kg"}`
              : isJunk
              ? `${goal.current ?? 0} of ${goal.targetValue} junk meals this week${overLimit ? " - over limit" : ""}`
              : `${goal.current ?? 0}${goal.targetUnit ?? "kg"} of ${goal.targetValue}${goal.targetUnit ?? "kg"} (${progressPct}%)`}
          </p>
        </div>
      ) : null}
    </li>
  );
}

function buildSubtitle(g) {
  const parts = [];
  if (g.kind === "lift" && g.exerciseName) parts.push(g.exerciseName);
  if (g.targetDate) parts.push(`by ${g.targetDate}`);
  return parts.join(" · ");
}

function GoalDialog({ open, onOpenChange, goal, exercises, onSaved }) {
  const isEdit = !!goal;
  const [kind, setKind] = useState("lift");
  const [exerciseId, setExerciseId] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [targetUnit, setTargetUnit] = useState("kg");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (goal) {
      setKind(goal.kind);
      setExerciseId(goal.exerciseId != null ? String(goal.exerciseId) : "");
      setTargetValue(goal.targetValue != null ? String(goal.targetValue) : "");
      setTargetUnit(goal.targetUnit ?? "kg");
      setTargetDate(goal.targetDate ?? "");
      setDescription(goal.description ?? "");
    } else {
      setKind("lift");
      setExerciseId("");
      setTargetValue("");
      setTargetUnit("kg");
      setTargetDate("");
      setDescription("");
    }
    setExerciseSearch("");
  }, [open, goal]);

  const filteredExercises = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase();
    return q
      ? (exercises ?? []).filter(
          (e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
        )
      : exercises ?? [];
  }, [exercises, exerciseSearch]);

  const save = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Add a one-line description");
      return;
    }
    if (kind === "lift" && !exerciseId) {
      toast.error("Pick an exercise");
      return;
    }
    if ((kind === "lift" || kind === "weight" || kind === "junk-limit") && !targetValue) {
      toast.error("Set a target number");
      return;
    }
    setSaving(true);
    const payload = {
      kind,
      exerciseId: kind === "lift" ? Number(exerciseId) : null,
      targetValue: targetValue ? Number(targetValue) : null,
      targetUnit: targetUnit || null,
      targetDate: targetDate || null,
      description: description.trim(),
    };
    try {
      if (isEdit) {
        await GlobalApi.UpdateGoal({ id: goal.id, ...payload });
        toast.success("Goal updated");
      } else {
        await GlobalApi.CreateGoal(payload);
        toast.success("Goal added");
      }
      onSaved?.();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit goal" : "New goal"}</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <Label>Type</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {Object.entries(KIND_META).map(([key, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setKind(key);
                        if (key === "weight" || key === "lift") setTargetUnit("kg");
                        else if (key === "junk-limit") setTargetUnit("meals");
                      }}
                      className={cn(
                        "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                        kind === key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-desc">Description</Label>
              <Input
                id="goal-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Bench 100kg by August"
                maxLength={120}
                autoFocus
              />
            </div>

            {kind === "lift" ? (
              <div className="space-y-1.5">
                <Label>Exercise</Label>
                <Input
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  placeholder="Search the library"
                />
                <div className="max-h-32 overflow-y-auto rounded-lg border">
                  {filteredExercises.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No matches.</p>
                  ) : (
                    filteredExercises.map((ex) => (
                      <button
                        type="button"
                        key={ex.id}
                        onClick={() => setExerciseId(String(ex.id))}
                        className={cn(
                          "flex w-full items-center justify-between border-b px-3 py-1.5 text-left text-xs last:border-b-0 transition-colors",
                          String(exerciseId) === String(ex.id)
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-accent"
                        )}
                      >
                        <span>{ex.name}</span>
                        <span className="text-[10px] text-muted-foreground">{ex.muscleGroup}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {kind !== "custom" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="goal-target">
                    {kind === "junk-limit" ? "Max junk meals / week" : "Target"}
                  </Label>
                  <Input
                    id="goal-target"
                    type="number"
                    step={kind === "junk-limit" ? "1" : "0.5"}
                    min={kind === "junk-limit" ? "0" : undefined}
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder={
                      kind === "weight" ? "e.g. 75" : kind === "junk-limit" ? "e.g. 3" : "e.g. 100"
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="goal-unit">Unit</Label>
                  <select
                    id="goal-unit"
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
                    disabled={kind === "junk-limit"}
                  >
                    {kind === "junk-limit" ? (
                      <option value="meals">meals</option>
                    ) : (
                      <>
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                        {kind === "lift" ? <option value="reps">reps</option> : null}
                      </>
                    )}
                  </select>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="goal-date">Target date (optional)</Label>
              <Input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
