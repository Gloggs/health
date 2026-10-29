"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ListChecks,
  Plus,
  ChevronRight,
  Star,
  Trash,
  StarOff,
} from "lucide-react";
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
import GlobalApi from "@/app/_services/GlobalApi";

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repeatWeekly, setRepeatWeekly] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    GlobalApi.ListPlans()
      .then((r) => setPlans(r.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give your plan a name");
      return;
    }
    setSaving(true);
    try {
      await GlobalApi.CreatePlan({
        name: name.trim(),
        description: description.trim() || null,
        repeatWeekly,
      });
      toast.success("Plan created");
      setName("");
      setDescription("");
      setRepeatWeekly(true);
      setCreateOpen(false);
      load();
    } catch {
      toast.error("Failed to create plan");
    } finally {
      setSaving(false);
    }
  };

  const activate = (id) => {
    GlobalApi.ActivatePlan(id)
      .then(() => {
        toast.success("Plan activated");
        load();
      })
      .catch(() => toast.error("Failed to activate"));
  };

  const handleDelete = (id) => {
    GlobalApi.DeletePlan(id)
      .then(() => {
        toast.success("Plan deleted");
        load();
      })
      .catch(() => toast.error("Failed to delete"));
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Plans</h2>
          <p className="text-sm text-muted-foreground">
            Build a weekly routine. Mark one as active and it shows on your Today screen.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New plan
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListChecks className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium">No plans yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Create your first plan and set it active.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {plans.map((p) => (
            <div
              key={p.id}
              className="hover-lift border border-foreground bg-card p-5  transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/dashboard/plans/${p.id}`} className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold">{p.name}</h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  )}
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {p.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      <Star className="h-3 w-3" /> Active
                    </span>
                  ) : null}
                  <span
                    className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium ${
                      p.repeatWeekly === false
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : "border-border text-muted-foreground"
                    }`}
                    title={p.repeatWeekly === false ? "One-off, expires 7 days after activation" : "Repeats every week"}
                  >
                    {p.repeatWeekly === false ? "One-off" : "Repeats"}
                  </span>
                </div>
              </div>

              <PlanWeek days={p.days ?? []} />

              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground/80 tabular-nums">
                    {p.trainingDays ?? 0}
                  </span>{" "}
                  training day{(p.trainingDays ?? 0) === 1 ? "" : "s"}
                  {" · "}
                  <span className="font-medium text-foreground/80 tabular-nums">
                    {p.restDays ?? 7}
                  </span>{" "}
                  rest
                </span>
                <Link
                  href={`/dashboard/plans/${p.id}`}
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  Edit <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80 tabular-nums">
                  {p.exerciseCount ?? 0}
                </span>{" "}
                exercises programmed
              </p>

              <div className="mt-3 flex gap-1.5 border-t pt-3">
                {p.isActive ? (
                  <Button variant="outline" size="sm" className="h-8 flex-1" disabled>
                    <StarOff className="mr-1 h-3.5 w-3.5" /> Active
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => activate(p.id)}>
                    <Star className="mr-1 h-3.5 w-3.5" /> Make active
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete plan"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        <span className="font-medium">{p.name}</span> and all its programmed days will be deleted. Past sessions stay logged.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(p.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <form onSubmit={create}>
            <DialogHeader>
              <DialogTitle>New plan</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="plan-name">Name</Label>
                <Input
                  id="plan-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Push / Pull / Legs"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-desc">Description (optional)</Label>
                <Input
                  id="plan-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Free text for context"
                />
              </div>

              <button
                type="button"
                onClick={() => setRepeatWeekly((v) => !v)}
                aria-pressed={repeatWeekly}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  repeatWeekly ? "border-primary/40 bg-primary/5" : "border-border"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    repeatWeekly
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {repeatWeekly ? <span className="text-[10px] leading-none">✓</span> : null}
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Repeat every week</p>
                  <p className="text-[11px] text-muted-foreground">
                    Off = one-off training block. It auto-deactivates seven days
                    after you make it active.
                  </p>
                </div>
              </button>

              <p className="text-xs text-muted-foreground">
                Seven day slots (Mon to Sun) will be created and start as "Rest". Edit each from the plan page.
              </p>
            </div>
            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Inline weekday strip - seven pips, primary tint when the day has a label
// other than "Rest". Tooltip on hover via title attribute.
function PlanWeek({ days }) {
  const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const byIdx = new Map((days ?? []).map((d) => [d.dayIndex, d.label]));
  return (
    <div className="mt-4 flex gap-1">
      {DAY_LETTERS.map((letter, i) => {
        const label = byIdx.get(i) ?? "Rest";
        const isRest = label === "Rest";
        return (
          <div
            key={i}
            className="flex flex-1 flex-col items-center gap-1"
            title={`${DAY_NAMES[i]}: ${label}`}
          >
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {letter}
            </span>
            <div
              className={
                isRest
                  ? "h-7 w-full rounded-md border border-dashed border-border/60"
                  : "flex h-7 w-full items-center justify-center rounded-md bg-primary/15 text-[10px] font-semibold text-primary"
              }
            >
              {isRest ? null : label.slice(0, 4)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
