"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  UtensilsCrossed,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Plus,
  ArrowRight,
  Trash2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import GlobalApi from "@/app/_services/GlobalApi";

const SLOTS = [
  { key: "breakfast", label: "Breakfast", icon: Coffee },
  { key: "lunch", label: "Lunch", icon: Sun },
  { key: "dinner", label: "Dinner", icon: Moon },
  { key: "snack", label: "Snack", icon: Cookie },
];

const QUALITY = [
  { v: 1, label: "Junk", tone: "destructive" },
  { v: 2, label: "Mixed", tone: "warning" },
  { v: 3, label: "Healthy", tone: "success" },
];

function qualityTone(q) {
  const m = QUALITY.find((x) => x.v === q);
  return m?.tone ?? "muted";
}

// The meals surface used on Today AND on the Log → Meals page for past-day
// editing. Four slot rows with inline log; junk count is surfaced in the
// header so the user gets an immediate "how am I eating" read.
//
// Props:
//   - meals: array of MEAL_LOGS rows for the target date
//   - today: YYYY-MM-DD - the date saves/edits write against (named "today"
//     for legacy reasons; can be any date when used from the past-day editor)
//   - onChanged(): trigger SWR mutate after save/delete
//   - label: override the header label (e.g. "Meals on Fri, 5 May") - omit
//     for the default "Meals today"
export default function MealsCard({ meals, today, onChanged, label }) {
  const list = meals ?? [];
  const bySlot = new Map();
  for (const s of SLOTS) bySlot.set(s.key, []);
  for (const m of list) {
    if (bySlot.has(m.slot)) bySlot.get(m.slot).push(m);
  }
  const total = list.length;
  const junkCount = list.filter((m) => m.quality === 1).length;
  const healthyCount = list.filter((m) => m.quality === 3).length;

  // Slot pip palette - at-a-glance status of the 4 slots in the header.
  const pipFor = (slotKey) => {
    const entries = bySlot.get(slotKey) ?? [];
    if (entries.length === 0) return "border border-dashed border-border";
    // If any entry in this slot is junk, lean junk; else if all healthy, healthy; else mixed.
    const qualities = entries.map((e) => e.quality).filter(Boolean);
    if (qualities.includes(1)) return "bg-destructive";
    if (qualities.length > 0 && qualities.every((q) => q === 3)) return "bg-[hsl(var(--chart-3))]";
    if (qualities.length > 0) return "bg-warning";
    return "bg-muted-foreground/40";
  };

  return (
    <div className="rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label ?? "Meals today"}</p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <p className="font-mono text-2xl font-bold leading-none tabular-nums">{total}</p>
              <p className="text-xs text-muted-foreground">
                logged
                {junkCount > 0 ? <span className="ml-2 text-destructive">· {junkCount} junk</span> : null}
                {healthyCount > 0 ? <span className="ml-2 text-success">· {healthyCount} healthy</span> : null}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1 sm:flex" aria-label="Slot status">
            {SLOTS.map((s) => (
              <span
                key={s.key}
                title={s.label}
                className={cn("h-2 w-6 rounded-full", pipFor(s.key))}
              />
            ))}
          </div>
          <Link
            href="/dashboard/log/meals"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            History <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {SLOTS.map((s) => (
          <SlotRow
            key={s.key}
            slot={s}
            meals={bySlot.get(s.key) ?? []}
            today={today}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </div>
  );
}

function SlotRow({ slot, meals, today, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [quality, setQuality] = useState(null);
  const [saving, setSaving] = useState(false);
  // Per-row inline edit state: editing a specific existing meal entry.
  const [editingId, setEditingId] = useState(null);
  const [editDesc, setEditDesc] = useState("");
  const [editQuality, setEditQuality] = useState(null);
  const Icon = slot.icon;

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditDesc(m.description ?? "");
    setEditQuality(m.quality ?? null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDesc("");
    setEditQuality(null);
  };
  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await GlobalApi.UpdateMeal({
        id: editingId,
        description: editDesc.trim() || null,
        quality: editQuality,
      });
      cancelEdit();
      // `onChanged` accepts an optional patch describing what changed so the
      // parent can apply an optimistic SWR update before the background
      // refetch completes. Pages that only need a refetch (the Log → Meals
      // page) ignore the argument.
      onChanged?.({ action: "update", row: res?.data });
      toast.success("Updated");
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed";
      toast.error(msg);
    }
  };

  const reset = () => {
    setDescription("");
    setQuality(null);
  };

  // Surface the actual API error so schema-out-of-sync issues are visible
  // rather than being swallowed as a generic "Failed".
  const errMsg = (err, fallback) =>
    err?.response?.data?.error ?? err?.message ?? fallback;

  const save = async (e) => {
    e?.preventDefault?.();
    if (!description.trim() && !quality) {
      toast.error("Add a quick description or tap a quality");
      return;
    }
    setSaving(true);
    try {
      const res = await GlobalApi.SaveMeal({
        date: today,
        slot: slot.key,
        description: description.trim() || null,
        quality,
      });
      reset();
      setExpanded(false);
      // Pass the new row to the parent so it can update its SWR cache
      // immediately - the Today screen otherwise shows "0 logged" until
      // the background refetch resolves a beat later.
      onChanged?.({ action: "add", row: res?.data });
      toast.success(`${slot.label} logged`);
    } catch (err) {
      toast.error(errMsg(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await GlobalApi.DeleteMeal(id);
      onChanged?.({ action: "delete", id });
    } catch (err) {
      toast.error(errMsg(err, "Failed to delete"));
    }
  };

  const isEmpty = meals.length === 0;
  return (
    <li
      className={cn(
        "rounded-xl p-3 transition-colors",
        isEmpty
          ? "border border-dashed border-border/60 bg-transparent hover:border-primary/40"
          : "border border-border bg-card/60"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            isEmpty ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("text-sm font-medium", isEmpty && "text-muted-foreground")}>
              {slot.label}
            </p>
            <button
              type="button"
              onClick={() => setExpanded((s) => !s)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                expanded
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-label={expanded ? "Collapse" : "Log meal"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>

          {isEmpty && !expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-0.5 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              tap to etch
            </button>
          ) : null}

          {meals.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {meals.map((m) => {
                const isEditing = editingId === m.id;
                if (isEditing) {
                  return (
                    <li
                      key={m.id}
                      className="space-y-1.5 rounded-md border border-primary/40 bg-background p-2"
                    >
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description"
                        maxLength={120}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="w-full rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                      />
                      <div className="flex gap-1">
                        {QUALITY.map((q) => (
                          <button
                            key={q.v}
                            type="button"
                            onClick={() => setEditQuality(q.v === editQuality ? null : q.v)}
                            aria-pressed={editQuality === q.v}
                            className={cn(
                              "flex-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold transition-colors",
                              editQuality === q.v
                                ? q.tone === "destructive"
                                  ? "border-destructive bg-destructive/15 text-destructive"
                                  : q.tone === "warning"
                                  ? "border-warning bg-warning/15 text-warning"
                                  : "border-success bg-success/15 text-success"
                                : "border-border"
                            )}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground hover:opacity-90"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={m.id} className="group flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.quality ? <QualityDot quality={m.quality} /> : null}
                        <span className="text-foreground/90">
                          {m.description || <em className="text-muted-foreground">(no notes)</em>}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        aria-label="Edit meal"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        aria-label="Delete meal"
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {expanded ? (
            <form onSubmit={save} className="mt-3 space-y-2 border-t pt-2.5">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you eat? (optional)"
                maxLength={120}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                autoFocus
              />
              <div className="flex gap-1.5">
                {QUALITY.map((q) => (
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
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setExpanded(false);
                  }}
                  className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Etching…" : "Etch it"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function QualityDot({ quality }) {
  const tone = qualityTone(quality);
  const labelMap = { 1: "Junk", 2: "Mixed", 3: "Healthy" };
  const toneCls =
    tone === "destructive"
      ? "border-destructive/40 bg-destructive/15 text-destructive"
      : tone === "warning"
      ? "border-warning/40 bg-warning/15 text-warning"
      : tone === "success"
      ? "border-success/40 bg-success/15 text-success"
      : "border-border text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider",
        toneCls
      )}
    >
      {labelMap[quality] ?? "?"}
    </span>
  );
}
