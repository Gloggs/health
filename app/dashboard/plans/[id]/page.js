"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash,
  Pencil,
  Dumbbell,
  Star,
  Bed,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { formatPlanTargets, isCardio } from "@/lib/planTargets";
import GlobalApi from "@/app/_services/GlobalApi";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PlanEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard/plans");
  };
  const [plan, setPlan] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState("0");
  const [editDayOpen, setEditDayOpen] = useState(false);
  const [editDay, setEditDay] = useState(null);
  const [addExOpen, setAddExOpen] = useState(false);
  const [addExDay, setAddExDay] = useState(null);
  const [editPeOpen, setEditPeOpen] = useState(false);
  const [editPe, setEditPe] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);

  // Persist the active day tab in the URL so a refresh stays on the same day.
  // Read on mount; rewrite via router.replace whenever the user switches tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const day = new URL(window.location.href).searchParams.get("day");
    if (day && /^[0-6]$/.test(day)) setActiveDay(day);
  }, []);
  const onDayChange = (next) => {
    setActiveDay(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("day", next);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const load = () => {
    setLoading(true);
    Promise.all([GlobalApi.GetPlan(id), GlobalApi.ListExercises()])
      .then(([p, e]) => {
        setPlan(p.data);
        setExercises(e.data ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const days = plan?.days ?? [];

  const activate = () => {
    GlobalApi.ActivatePlan(plan.id)
      .then(() => {
        toast.success("Plan activated");
        load();
      })
      .catch(() => toast.error("Failed to activate"));
  };

  const saveDayLabel = (dayIndex, label) => {
    GlobalApi.UpsertPlanDay({ planId: plan.id, dayIndex, label })
      .then(() => {
        toast.success("Day updated");
        setEditDayOpen(false);
        load();
      })
      .catch(() => toast.error("Failed to update day"));
  };

  const removeExercise = (peId) => {
    GlobalApi.RemovePlanExercise(peId)
      .then(() => {
        toast.success("Removed");
        load();
      })
      .catch(() => toast.error("Failed to remove"));
  };

  // Swap two exercises' positions in the same day. Uses the partial-update
  // PUT so targets/notes aren't clobbered.
  const moveExercise = async (day, index, direction) => {
    const list = day.exercises;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const a = list[index];
    const b = list[targetIndex];
    try {
      await Promise.all([
        GlobalApi.UpdatePlanExercise({ id: a.id, position: b.position }),
        GlobalApi.UpdatePlanExercise({ id: b.id, position: a.position }),
      ]);
      load();
    } catch {
      toast.error("Failed to reorder");
    }
  };

  // Full reorder after drag-and-drop. We renumber 0..N-1 for the affected day
  // and patch every row whose position changed. Optimistically updates local
  // state so the row animates in place before the API round-trip finishes.
  const reorderDay = async (day, nextOrder) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((d) =>
        d.id === day.id
          ? { ...d, exercises: nextOrder.map((pe, i) => ({ ...pe, position: i })) }
          : d
      );
      return { ...prev, days };
    });
    try {
      const changes = nextOrder
        .map((pe, i) => ({ id: pe.id, position: i, prev: pe.position }))
        .filter((c) => c.prev !== c.position);
      await Promise.all(
        changes.map((c) => GlobalApi.UpdatePlanExercise({ id: c.id, position: c.position }))
      );
    } catch {
      toast.error("Failed to reorder");
      load();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Plan not found.</p>
        <button onClick={goBack} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <button onClick={goBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{plan.name}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setRenameOpen(true)}
              aria-label="Rename plan"
              title="Rename plan"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
          {plan.description ? (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {plan.repeatWeekly === false ? "One-off week" : "Repeats every week"}
          </p>
        </div>
        {plan.isActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Star className="h-3 w-3" /> Active
          </span>
        ) : (
          <Button variant="outline" onClick={activate}>
            <Star className="mr-1.5 h-4 w-4" /> Make active
          </Button>
        )}
      </div>

      <Tabs value={activeDay} onValueChange={onDayChange} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          {DAYS.map((d, i) => {
            const day = days[i];
            const isRest = day?.label === "Rest";
            return (
              <TabsTrigger key={d} value={String(i)} className="text-xs">
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d[0]}</span>
                {!isRest && <span className="ml-1.5 h-1 w-1 rounded-full bg-primary" />}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {days.map((day, idx) => (
          <TabsContent key={day.id} value={String(idx)} className="mt-4 space-y-4">
            <div className="border border-foreground bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      day.label === "Rest" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                    )}
                  >
                    {day.label === "Rest" ? <Bed className="h-5 w-5" /> : <Dumbbell className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{DAYS[day.dayIndex]}</p>
                    <p className="text-lg font-semibold">{day.label}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditDay(day);
                    setEditDayOpen(true);
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Rename
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {day.exercises.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
                  <Dumbbell className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No exercises programmed for {DAYS[day.dayIndex]} yet.</p>
                </div>
              ) : (
                <SortableExercises
                  day={day}
                  onReorder={reorderDay}
                  onMove={moveExercise}
                  onEdit={(pe) => { setEditPe(pe); setEditPeOpen(true); }}
                  onRemove={removeExercise}
                />
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setAddExDay(day);
                  setAddExOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add exercise to {DAYS[day.dayIndex]}
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <DayLabelDialog
        open={editDayOpen}
        onOpenChange={setEditDayOpen}
        day={editDay}
        onSave={saveDayLabel}
      />

      <AddExerciseDialog
        open={addExOpen}
        onOpenChange={setAddExOpen}
        day={addExDay}
        exercises={exercises}
        onAdded={() => {
          setAddExOpen(false);
          load();
        }}
      />

      <EditTargetsDialog
        open={editPeOpen}
        onOpenChange={setEditPeOpen}
        planExercise={editPe}
        onSaved={() => {
          setEditPeOpen(false);
          load();
        }}
      />

      <RenamePlanDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        plan={plan}
        onSaved={() => {
          setRenameOpen(false);
          load();
        }}
      />
    </div>
  );
}

function RenamePlanDialog({ open, onOpenChange, plan, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repeatWeekly, setRepeatWeekly] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && plan) {
      setName(plan.name ?? "");
      setDescription(plan.description ?? "");
      setRepeatWeekly(plan.repeatWeekly !== false);
    }
  }, [open, plan]);

  if (!plan) return null;

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Plan needs a name");
      return;
    }
    setSaving(true);
    try {
      await GlobalApi.UpdatePlan({
        id: plan.id,
        name: name.trim(),
        description: description.trim() || null,
        repeatWeekly,
      });
      toast.success("Plan updated");
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
            <DialogTitle>Rename plan</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan-rename-name">Name</Label>
              <Input
                id="plan-rename-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Push / Pull / Legs"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-rename-desc">Description (optional)</Label>
              <Input
                id="plan-rename-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Free text for context"
              />
            </div>
            <button
              type="button"
              onClick={() => setRepeatWeekly((v) => !v)}
              aria-pressed={repeatWeekly}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                repeatWeekly ? "border-primary/40 bg-primary/5" : "border-border"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  repeatWeekly
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                )}
              >
                {repeatWeekly ? <span className="text-[10px] leading-none">✓</span> : null}
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Repeat every week</p>
                <p className="text-[11px] text-muted-foreground">
                  When off, the plan auto-deactivates seven days after you activated it -
                  use this for one-off training blocks.
                </p>
              </div>
            </button>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DayLabelDialog({ open, onOpenChange, day, onSave }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (open && day) setLabel(day.label);
  }, [open, day]);

  if (!day) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{DAYS[day.dayIndex]} label</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="day-label">Label</Label>
            <Input
              id="day-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Push, Pull, Legs, Rest…"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Push", "Pull", "Legs", "Upper", "Lower", "Full body", "Rest"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLabel(preset)}
                className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs hover:bg-accent"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(day.dayIndex, label.trim() || "Rest")}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddExerciseDialog({ open, onOpenChange, day, exercises, onAdded }) {
  const [exerciseId, setExerciseId] = useState(null);
  const [targetSets, setTargetSets] = useState("");
  const [targetReps, setTargetReps] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetDuration, setTargetDuration] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setExerciseId(null);
      setTargetSets("3");
      setTargetReps("8");
      setTargetWeight("");
      setTargetDuration("30");
      setTargetDistance("");
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? exercises.filter((e) =>
          e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
        )
      : exercises;
  }, [exercises, search]);

  const selected = exercises.find((e) => e.id === exerciseId) ?? null;
  const cardio = isCardio(selected);

  if (!day) return null;

  const add = async (e) => {
    e.preventDefault();
    if (!exerciseId) {
      toast.error("Pick an exercise");
      return;
    }
    setSaving(true);
    try {
      const base = { planDayId: day.id, exerciseId };
      const payload = cardio
        ? {
            ...base,
            targetDurationMinutes: targetDuration ? Number(targetDuration) : null,
            targetDistanceKm: targetDistance ? Number(targetDistance) : null,
          }
        : {
            ...base,
            targetSets: targetSets ? Number(targetSets) : null,
            targetReps: targetReps ? Number(targetReps) : null,
            targetWeight: targetWeight ? Number(targetWeight) : null,
          };
      await GlobalApi.AddPlanExercise(payload);
      toast.success("Exercise added");
      onAdded?.();
    } catch {
      toast.error("Failed to add exercise");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={add}>
          <DialogHeader>
            <DialogTitle>Add to {DAYS[day.dayIndex]} · {day.label}</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Pick exercise</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the library"
              />
              <div className="max-h-44 overflow-y-auto rounded-lg border">
                {filtered.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No matches</p>
                ) : (
                  filtered.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => setExerciseId(e.id)}
                      className={cn(
                        "flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 transition-colors",
                        exerciseId === e.id ? "bg-primary/10 text-primary" : "hover:bg-accent"
                      )}
                    >
                      <span>{e.name}</span>
                      <span className="text-[11px] text-muted-foreground">{e.muscleGroup}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {cardio ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-duration">Duration (min)</Label>
                  <Input
                    id="t-duration"
                    type="number"
                    min="0"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-distance">Distance (km, optional)</Label>
                  <Input
                    id="t-distance"
                    type="number"
                    step="0.1"
                    min="0"
                    value={targetDistance}
                    onChange={(e) => setTargetDistance(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-sets">Sets</Label>
                  <Input id="t-sets" type="number" min="0" value={targetSets} onChange={(e) => setTargetSets(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-reps">Reps</Label>
                  <Input id="t-reps" type="number" min="0" value={targetReps} onChange={(e) => setTargetReps(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-weight">Weight (kg)</Label>
                  <Input id="t-weight" type="number" step="0.5" min="0" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !exerciseId}>
              {saving ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTargetsDialog({ open, onOpenChange, planExercise, onSaved }) {
  const [targetSets, setTargetSets] = useState("");
  const [targetReps, setTargetReps] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetDuration, setTargetDuration] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const cardio = isCardio(planExercise);

  useEffect(() => {
    if (open && planExercise) {
      setTargetSets(planExercise.targetSets != null ? String(planExercise.targetSets) : "");
      setTargetReps(planExercise.targetReps != null ? String(planExercise.targetReps) : "");
      setTargetWeight(planExercise.targetWeight != null ? String(planExercise.targetWeight) : "");
      setTargetDuration(
        planExercise.targetDurationMinutes != null ? String(planExercise.targetDurationMinutes) : ""
      );
      setTargetDistance(
        planExercise.targetDistanceKm != null ? String(planExercise.targetDistanceKm) : ""
      );
      setNotes(planExercise.notes ?? "");
    }
  }, [open, planExercise]);

  if (!planExercise) return null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = cardio
        ? {
            id: planExercise.id,
            targetDurationMinutes: targetDuration ? Number(targetDuration) : null,
            targetDistanceKm: targetDistance ? Number(targetDistance) : null,
            targetSets: null,
            targetReps: null,
            targetWeight: null,
            notes: notes.trim() || null,
          }
        : {
            id: planExercise.id,
            targetSets: targetSets ? Number(targetSets) : null,
            targetReps: targetReps ? Number(targetReps) : null,
            targetWeight: targetWeight ? Number(targetWeight) : null,
            targetDurationMinutes: null,
            targetDistanceKm: null,
            notes: notes.trim() || null,
          };
      await GlobalApi.UpdatePlanExercise(payload);
      toast.success("Targets updated");
      onSaved?.();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{planExercise.name}</DialogTitle>
          </DialogHeader>
          {cardio ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-duration">Duration (min)</Label>
                <Input
                  id="e-duration"
                  type="number"
                  min="0"
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-distance">Distance (km, optional)</Label>
                <Input
                  id="e-distance"
                  type="number"
                  step="0.1"
                  min="0"
                  value={targetDistance}
                  onChange={(e) => setTargetDistance(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-sets">Sets</Label>
                <Input id="e-sets" type="number" min="0" value={targetSets} onChange={(e) => setTargetSets(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-reps">Reps</Label>
                <Input id="e-reps" type="number" min="0" value={targetReps} onChange={(e) => setTargetReps(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-weight">Weight (kg)</Label>
                <Input id="e-weight" type="number" step="0.5" min="0" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
              </div>
            </div>
          )}
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="e-notes">Notes (form cues, RPE, pace)</Label>
            <textarea
              id="e-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={cardio ? "e.g. zone 2, easy pace" : "e.g. 2-sec pause at the bottom, RPE 8"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Wraps a day's exercise list in a dnd-kit sortable context. The drag handle
// works on touch (mobile) and pointer; up/down arrow buttons stay available
// for keyboard / no-touch users. Smooth sort transition comes from dnd-kit's
// built-in CSS transform animation.
function SortableExercises({ day, onReorder, onMove, onEdit, onRemove }) {
  const sensors = useSensors(
    // 6px pointer activation distance stops accidental drags when you meant to tap.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = day.exercises.map((pe) => pe.id);

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const nextOrder = arrayMove(day.exercises, oldIdx, newIdx);
    onReorder(day, nextOrder);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {day.exercises.map((pe, peIdx) => (
            <SortableExerciseRow
              key={pe.id}
              pe={pe}
              index={peIdx}
              total={day.exercises.length}
              onMoveUp={() => onMove(day, peIdx, -1)}
              onMoveDown={() => onMove(day, peIdx, 1)}
              onEdit={() => onEdit(pe)}
              onRemove={() => onRemove(pe.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableExerciseRow({ pe, index, total, onMoveUp, onMoveDown, onEdit, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pe.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "hover-lift flex items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-paper-1",
        isDragging && "z-10 cursor-grabbing opacity-80 shadow-lg ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="touch-none cursor-grab p-1 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move up"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Move down"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{pe.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {pe.muscleGroup} · {pe.equipment}
          {formatPlanTargets(pe)}
        </p>
        {pe.notes ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
            {pe.notes}
          </p>
        ) : null}
      </div>
      <div className="flex gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onEdit}
          aria-label="Edit targets"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove"
        >
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
