"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import GlobalApi from "@/app/_services/GlobalApi";
import ExerciseRow from "./ExerciseRow";

// Rest-day training surface. The user trained anyway, so we let them pick
// exercises from the library and log sets just like a planned day.
//
// Sets that have been logged come from todaySession.sets (each joined to
// EXERCISES on the dashboard endpoint so we get name/muscleGroup). Exercises
// the user has picked but not yet logged a set for live in local component
// state - they appear as empty rows ready for input.
export default function AdHocTraining({
  sets,
  exerciseMaxes,
  disabled,
  onLogSet,
  onBulkLogSets,
  onRemoveSet,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [library, setLibrary] = useState(null);
  const [pending, setPending] = useState([]); // {id, name, muscleGroup, equipment}[]

  const openPicker = async () => {
    if (!library) {
      try {
        const r = await GlobalApi.ListExercises();
        setLibrary(r.data ?? []);
      } catch {
        setLibrary([]);
      }
    }
    setPickerOpen(true);
  };

  // Group logged sets by exerciseId so each exercise renders once.
  const groupedSets = useMemo(() => {
    const m = new Map();
    for (const s of sets ?? []) {
      if (!m.has(s.exerciseId)) {
        m.set(s.exerciseId, {
          exerciseId: s.exerciseId,
          name: s.exerciseName ?? "Exercise",
          muscleGroup: s.muscleGroup ?? "",
          equipment: s.equipment ?? "",
          sets: [],
        });
      }
      m.get(s.exerciseId).sets.push(s);
    }
    return m;
  }, [sets]);

  // Logged exercises first, then any pending picks that haven't been logged yet.
  const ordered = useMemo(() => {
    const out = [];
    for (const info of groupedSets.values()) {
      out.push({
        pe: {
          id: `adhoc-${info.exerciseId}`,
          exerciseId: info.exerciseId,
          name: info.name,
          muscleGroup: info.muscleGroup,
          equipment: info.equipment,
        },
        sets: info.sets,
      });
    }
    for (const ex of pending) {
      if (!groupedSets.has(ex.id)) {
        out.push({
          pe: {
            id: `adhoc-${ex.id}`,
            exerciseId: ex.id,
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            equipment: ex.equipment,
          },
          sets: [],
        });
      }
    }
    return out;
  }, [groupedSets, pending]);

  const pickExercise = (ex) => {
    setPending((prev) => (prev.find((x) => x.id === ex.id) ? prev : [...prev, ex]));
    setPickerOpen(false);
  };

  // Once the user actually logs a set, the exercise is now in groupedSets;
  // we can drop it from `pending` to keep state tidy.
  useEffect(() => {
    setPending((prev) => prev.filter((ex) => !groupedSets.has(ex.id)));
  }, [groupedSets]);

  if (ordered.length === 0) {
    return (
      <>
        <div className="mt-6 rounded-xl border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm font-medium">Rest day on the plan.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Trained anyway? Pick what you did - each exercise gets its own row,
            log sets as you go.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openPicker}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add what you did
          </Button>
        </div>
        <AdHocPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          library={library ?? []}
          onPick={pickExercise}
        />
      </>
    );
  }

  return (
    <>
      <ul className="mt-5 space-y-2 stagger-children">
        {ordered.map((row) => (
          <ExerciseRow
            key={row.pe.id}
            pe={row.pe}
            sets={row.sets}
            previousMax={exerciseMaxes?.[row.pe.exerciseId] ?? null}
            skipped={false}
            disabled={disabled}
            onLogSet={(set) => onLogSet(row.pe, set)}
            onBulkLogSets={(bulk) => onBulkLogSets?.(row.pe, bulk)}
            onRemoveSet={onRemoveSet}
            onToggleSkip={() => {}}
          />
        ))}
      </ul>
      {!disabled ? (
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={openPicker}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add another exercise
        </Button>
      ) : null}
      <AdHocPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        library={library ?? []}
        onPick={pickExercise}
      />
    </>
  );
}

function AdHocPickerDialog({ open, onOpenChange, library, onPick }) {
  const [search, setSearch] = useState("");
  useEffect(() => { if (open) setSearch(""); }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? library.filter((e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q))
      : library;
  }, [library, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Pick an exercise</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the library"
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            {filtered.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No matches.</p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onPick(e)}
                  className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 transition-colors hover:bg-accent"
                >
                  <span>{e.name}</span>
                  <span className="text-[11px] text-muted-foreground">{e.muscleGroup}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
