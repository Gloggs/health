"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dumbbell, Plus, Pencil, Trash, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import GlobalApi from "@/app/_services/GlobalApi";
import ExerciseDialog from "./_components/ExerciseDialog";
import PageHero from "../_components/PageHero";

const MUSCLE_TONES = {
  Chest: "bg-chart-1/15 text-chart-1",
  Back: "bg-chart-2/15 text-chart-2",
  Legs: "bg-chart-3/15 text-chart-3",
  Shoulders: "bg-chart-4/15 text-chart-4",
  Arms: "bg-chart-5/15 text-chart-5",
  Core: "bg-primary/15 text-primary",
  Cardio: "bg-warning/15 text-warning",
};

const ALL = "__all";

export default function ExercisesPage() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState(ALL);

  const load = () => {
    setLoading(true);
    GlobalApi.ListExercises()
      .then((r) => setExercises(r.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const muscleGroups = useMemo(() => {
    const set = new Set(exercises.map((e) => e.muscleGroup));
    return Array.from(set).sort();
  }, [exercises]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (muscleFilter !== ALL && e.muscleGroup !== muscleFilter) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.equipment.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, search, muscleFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      if (!map.has(e.muscleGroup)) map.set(e.muscleGroup, []);
      map.get(e.muscleGroup).push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleDelete = (id) => {
    GlobalApi.DeleteExercise(id)
      .then(() => {
        toast.success("Exercise removed");
        load();
      })
      .catch(() => toast.error("Failed to delete"));
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        title="Exercises"
        subtitle={loading ? "Loading" : `${exercises.length} in your library`}
        right={
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> New exercise
        </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises"
            className="pl-9"
          />
        </div>
        <Select value={muscleFilter} onValueChange={setMuscleFilter}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="All muscle groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All muscle groups</SelectItem>
            {muscleGroups.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Dumbbell className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">
            {exercises.length === 0 ? "No exercises yet" : "No matches"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([muscle, list]) => (
            <section key={muscle} className="space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {muscle}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
                  {list.length}
                </span>
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
                {list.map((e) => (
                  <div
                    key={e.id}
                    className="hover-lift flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-paper-1"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${MUSCLE_TONES[muscle] ?? "bg-muted text-muted-foreground"}`}
                      >
                        <Dumbbell className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{e.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{e.equipment}</p>
                      </div>
                    </div>
                    {e.isStarter ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">Starter</span>
                    ) : (
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => {
                          setEditing(e);
                          setOpen(true);
                        }}
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove this exercise?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <span className="font-medium">{e.name}</span> will be removed from your family's library, your plans and any sets logged with it.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(e.id)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ExerciseDialog
        open={open}
        onOpenChange={setOpen}
        exercise={editing}
        onSaved={() => {
          setOpen(false);
          load();
        }}
      />
    </div>
  );
}
