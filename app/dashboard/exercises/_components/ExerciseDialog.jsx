"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Footprints, Info } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import GlobalApi from "@/app/_services/GlobalApi";

const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Full body"];
const EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Other"];

// Names that strongly suggest the user wants cardio tracking (duration-based)
// rather than a strength exercise (sets/reps-based). We surface a soft hint
// so they're pointed at the Cardio section on Today, where minutes/distance
// are actually tracked.
const CARDIO_NAME_RX = /\b(walk|walking|run|running|jog|jogging|cycle|cycling|bike|biking|swim|swimming|hike|hiking|row|rowing|treadmill|elliptical|cardio)\b/i;

const DEFAULT = {
  name: "",
  muscleGroup: "Chest",
  equipment: "Barbell",
  notes: "",
};

export default function ExerciseDialog({ open, onOpenChange, exercise, onSaved }) {
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const isEdit = !!exercise?.id;

  // Detect cardio intent so we can nudge the user toward the Cardio section
  // instead of the strength-library. Triggered by either the muscle-group
  // pick or a cardio-like name.
  const looksLikeCardio = useMemo(
    () => form.muscleGroup === "Cardio" || CARDIO_NAME_RX.test(form.name),
    [form.muscleGroup, form.name]
  );

  useEffect(() => {
    if (open) {
      setForm(
        exercise
          ? {
              name: exercise.name ?? "",
              muscleGroup: exercise.muscleGroup ?? "Chest",
              equipment: exercise.equipment ?? "Bodyweight",
              notes: exercise.notes ?? "",
            }
          : DEFAULT
      );
    }
  }, [open, exercise]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(isEdit ? { id: exercise.id } : {}),
        name: form.name.trim(),
        muscleGroup: form.muscleGroup,
        equipment: form.equipment,
        notes: form.notes.trim() || null,
      };
      if (isEdit) {
        await GlobalApi.UpdateExercise(payload);
        toast.success("Exercise updated");
      } else {
        await GlobalApi.CreateExercise(payload);
        toast.success("Exercise added");
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
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit exercise" : "New exercise"}</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ex-name">Name</Label>
              <Input
                id="ex-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Romanian Deadlift"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Muscle group</Label>
                <Select value={form.muscleGroup} onValueChange={(v) => setForm((f) => ({ ...f, muscleGroup: v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Equipment</Label>
                <Select value={form.equipment} onValueChange={(v) => setForm((f) => ({ ...f, equipment: v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ex-notes">Notes (optional)</Label>
              <Input
                id="ex-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Cue, variation, anything you want to remember"
              />
            </div>

            {looksLikeCardio ? (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    This looks like cardio.
                  </p>
                  <p className="text-muted-foreground">
                    Walks, runs, cycles and other duration-based sessions live in the
                    Cardio section on Today, not the exercise library. The library is for
                    strength moves you program into a weekly plan (sets and reps).
                  </p>
                  <Link
                    href="/dashboard"
                    onClick={() => onOpenChange?.(false)}
                    className="mt-1 inline-flex items-center gap-1 font-medium text-warning hover:underline"
                  >
                    <Footprints className="h-3 w-3" /> Open the Cardio tile
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
