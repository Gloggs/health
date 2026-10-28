"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  UtensilsCrossed,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Trash2,
  Pencil,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { todayDateStr, daysAgoStr, prettyDate } from "@/lib/dates";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHeader from "../../_components/PageHeader";
import MealsCard from "../../_components/MealsCard";

function safeDateParam(raw, today) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : null;
}

const SLOT_META = {
  breakfast: { label: "Breakfast", icon: Coffee },
  lunch: { label: "Lunch", icon: Sun },
  dinner: { label: "Dinner", icon: Moon },
  snack: { label: "Snack", icon: Cookie },
};
const QUALITY = {
  1: { label: "Junk", tone: "destructive" },
  2: { label: "Mixed", tone: "warning" },
  3: { label: "Healthy", tone: "success" },
};

export default function MealsLogPage() {
  return (
    <Suspense fallback={null}>
      <MealsLogPageInner />
    </Suspense>
  );
}

function MealsLogPageInner() {
  const today = todayDateStr();
  const searchParams = useSearchParams();
  // `editDate` is the date being edited via the in-page MealsCard. Calendar
  // links land here with ?date=YYYY-MM-DD; otherwise we just show the
  // history. Set explicitly to null when no date is selected (i.e. browsing
  // mode) so we can distinguish from the initial undefined state.
  const [editDate, setEditDate] = useState(() => safeDateParam(searchParams.get("date"), today));
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = () => {
    GlobalApi.GetMeals({ from: daysAgoStr(30), to: today }).then((r) => setRows(r.data ?? []));
  };
  useEffect(() => {
    load();
  }, []);

  // Slice the loaded list down to the editing date - lets us reuse MealsCard
  // for the past-day editor without a second fetch.
  const editDateMeals = useMemo(
    () => (editDate && rows ? rows.filter((r) => r.date === editDate) : []),
    [rows, editDate]
  );

  const grouped = useMemo(() => {
    if (!rows) return null;
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.date)) m.set(r.date, []);
      m.get(r.date).push(r);
    }
    return Array.from(m.entries());
  }, [rows]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const total = rows.length;
    const junk = rows.filter((r) => r.quality === 1).length;
    const healthy = rows.filter((r) => r.quality === 3).length;
    const days = new Set(rows.map((r) => r.date)).size;
    return { total, junk, healthy, days };
  }, [rows]);

  const remove = async (id) => {
    try {
      await GlobalApi.DeleteMeal(id);
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const cycleQuality = async (m) => {
    const next = m.quality == null ? 3 : m.quality === 3 ? 2 : m.quality === 2 ? 1 : null;
    try {
      await GlobalApi.UpdateMeal({ id: m.id, quality: next });
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        fallback="/dashboard/log"
        icon={UtensilsCrossed}
        title="Meals"
        subtitle="Last 30 days. Tap a quality chip to cycle Junk → Mixed → Healthy → off."
      />

      {/* Past-day editor: when the calendar deep-links here with ?date=, drop
          a MealsCard for that date so the user can add/edit meals inline.
          When today is the target we don't render it (the Today screen already
          has the same card) - browsing mode just shows the 30-day history. */}
      {editDate && editDate !== today ? (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 shadow-paper-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                Editing past day
              </p>
              <p className="mt-0.5 text-sm font-semibold">{prettyDate(editDate)}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditDate(null)}
              className="rounded-full border px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              Done editing
            </button>
          </div>
          <MealsCard
            meals={editDateMeals}
            today={editDate}
            onChanged={load}
            label={`Meals on ${prettyDate(editDate)}`}
          />
        </div>
      ) : null}

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Meals" value={stats.total} />
          <KpiCard label="Healthy" value={stats.healthy} tone="success" />
          <KpiCard label="Junk" value={stats.junk} tone="destructive" />
          <KpiCard label="Days logged" value={stats.days} />
        </div>
      ) : null}

      {grouped === null ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-12 text-center">
          <p className="text-sm font-medium">No meals logged in the last 30 days.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the Meals card on Today to log breakfast, lunch, dinner or snacks.
          </p>
        </div>
      ) : null}

      <EditMealDialog
        meal={editing}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        onSaved={() => { setEditing(null); load(); }}
      />

      {grouped !== null && grouped.length > 0 ? (
        <ul className="space-y-4">
          {grouped.map(([date, meals]) => (
            <li key={date} className="rounded-2xl bg-card/70 p-4 shadow-paper-1 paper-texture">
              <p className="mb-3 text-sm font-semibold">{prettyDate(date)}</p>
              <ul className="space-y-2">
                {meals.map((m) => {
                  const meta = SLOT_META[m.slot] ?? { label: m.slot, icon: UtensilsCrossed };
                  const Icon = meta.icon;
                  return (
                    <li
                      key={m.id}
                      className="flex items-start gap-3 rounded-xl border bg-card/60 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{meta.label}</p>
                          <QualityChip quality={m.quality} onClick={() => cycleQuality(m)} />
                        </div>
                        {m.description ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
                        ) : (
                          <p className="mt-0.5 text-xs italic text-muted-foreground">(no notes)</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(m)}
                          aria-label="Edit"
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(m.id)}
                          aria-label="Delete"
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Editing flow: dialog opens with the meal pre-populated. Updates slot,
// quality and description in one PUT.
function EditMealDialog({ meal, onOpenChange, onSaved }) {
  const [slot, setSlot] = useState("breakfast");
  const [quality, setQuality] = useState(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (meal) {
      setSlot(meal.slot ?? "breakfast");
      setQuality(meal.quality ?? null);
      setDescription(meal.description ?? "");
    }
  }, [meal]);

  if (!meal) return null;

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      await GlobalApi.UpdateMeal({
        id: meal.id,
        slot,
        quality,
        description: description.trim() || null,
      });
      toast.success("Updated");
      onSaved?.();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!meal} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Edit meal</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="meal-slot">Slot</Label>
              <Select value={slot} onValueChange={setSlot}>
                <SelectTrigger id="meal-slot" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SLOT_META).map(([key, m]) => (
                    <SelectItem key={key} value={key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meal-desc">Description</Label>
              <Input
                id="meal-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you eat?"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quality</Label>
              <div className="flex gap-1.5">
                {[
                  { v: 1, label: "Junk", tone: "destructive" },
                  { v: 2, label: "Mixed", tone: "warning" },
                  { v: 3, label: "Healthy", tone: "success" },
                ].map((q) => (
                  <button
                    key={q.v}
                    type="button"
                    onClick={() => setQuality(q.v === quality ? null : q.v)}
                    aria-pressed={quality === q.v}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors",
                      quality === q.v
                        ? q.tone === "destructive"
                          ? "border-destructive bg-destructive/15 text-destructive"
                          : q.tone === "warning"
                          ? "border-warning bg-warning/15 text-warning"
                          : "border-success bg-success/15 text-success"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
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

function KpiCard({ label, value, tone }) {
  const toneCls =
    tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-2xl bg-card/70 p-4 shadow-paper-1 paper-texture">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", toneCls)}>{value}</p>
    </div>
  );
}

function QualityChip({ quality, onClick }) {
  const meta = QUALITY[quality];
  if (!meta) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-full border border-dashed px-2 py-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        + quality
      </button>
    );
  }
  const toneCls =
    meta.tone === "destructive"
      ? "border-destructive/40 bg-destructive/15 text-destructive"
      : meta.tone === "warning"
      ? "border-warning/40 bg-warning/15 text-warning"
      : "border-success/40 bg-success/15 text-success";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0 text-[10px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-80",
        toneCls
      )}
    >
      {meta.label}
    </button>
  );
}
