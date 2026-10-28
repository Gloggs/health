"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Footprints, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { todayDateStr, daysAgoStr, prettyDate } from "@/lib/dates";
import { formatMinutes, formatCount } from "@/lib/format";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHeader from "../../_components/PageHeader";
import EmptyState from "../../_components/states/EmptyState";

const TYPES = ["Walk", "Run", "Cycle", "Swim", "Hike", "Other"];

function safeDateParam(raw, today) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
}

export default function CardioPage() {
  return (
    <Suspense fallback={null}>
      <CardioPageInner />
    </Suspense>
  );
}

function CardioPageInner() {
  const today = todayDateStr();
  const searchParams = useSearchParams();
  const initialDate = safeDateParam(searchParams.get("date"), today);
  const [history, setHistory] = useState(null);
  const [form, setForm] = useState({
    date: initialDate,
    type: "Walk",
    durationMinutes: "",
    distanceKm: "",
    steps: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  // Set true on first load when type/duration are seeded from the most-
  // recent cardio entry. Cleared the moment the user touches either field.
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const load = () => {
    GlobalApi.GetCardio({ from: daysAgoStr(30), to: today }).then((r) => {
      const rows = r.data ?? [];
      setHistory(rows);
      // Yesterday-as-default (UX-PATTERNS §2): pre-fill type + duration
      // from the most-recent entry on first load, IF the form is still in
      // its untouched initial state. Distance/steps/note stay empty -
      // those vary too much between walks to make a useful default.
      setForm((prev) => {
        const untouched =
          prev.type === "Walk" &&
          prev.durationMinutes === "" &&
          prev.distanceKm === "" &&
          prev.steps === "" &&
          prev.note === "";
        if (!untouched || rows.length === 0) return prev;
        const recent = rows[0];
        setDefaultsApplied(true);
        return {
          ...prev,
          type: recent.type ?? "Walk",
          durationMinutes:
            recent.durationMinutes != null ? String(recent.durationMinutes) : "",
        };
      });
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Helper that updates form state AND clears the defaults-applied flag
  // so the "pre-filled from last walk" hint disappears once the user
  // overrides anything.
  const patchForm = (patch) => {
    setForm((s) => ({ ...s, ...patch }));
    setDefaultsApplied(false);
  };

  const submit = async () => {
    if (!form.durationMinutes && !form.distanceKm && !form.steps) {
      toast.error("Add duration, distance or steps");
      return;
    }
    setSaving(true);
    try {
      await GlobalApi.AddCardio({
        date: form.date,
        type: form.type,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        distanceKm: form.distanceKm ? Number(form.distanceKm) : null,
        steps: form.steps ? Number(form.steps) : null,
        note: form.note.trim() || null,
      });
      toast.success("Logged");
      setForm({ date: today, type: "Walk", durationMinutes: "", distanceKm: "", steps: "", note: "" });
      load();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await GlobalApi.DeleteCardio(id);
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        fallback="/dashboard/log"
        icon={Footprints}
        title="Walks + cardio"
        subtitle="Walks, runs, anything that moves the legs."
      />

      <div className="rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">New entry</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input
              type="date"
              value={form.date}
              max={today}
              onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => patchForm({ type: t })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    form.type === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Duration (min)</label>
            <Input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => patchForm({ durationMinutes: e.target.value })}
            />
            {defaultsApplied ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pre-filled from your last walk. Adjust anything before saving.
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Distance (km)</label>
            <Input
              type="number"
              step="0.01"
              value={form.distanceKm}
              onChange={(e) => setForm((s) => ({ ...s, distanceKm: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Steps (optional)</label>
            <Input
              type="number"
              value={form.steps}
              onChange={(e) => setForm((s) => ({ ...s, steps: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Note</label>
            <Input
              value={form.note}
              onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={saving}>
            <Plus className="mr-1.5 h-4 w-4" /> {saving ? "Etching…" : "Etch it"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Last 30 days</p>
        {history === null ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : history.length === 0 ? (
          <EmptyState compact title="nothing logged yet" />
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-xl border bg-card/60 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {h.type} · {prettyDate(h.date)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.durationMinutes ? formatMinutes(h.durationMinutes) : ""}
                    {h.distanceKm ? ` · ${h.distanceKm} km` : ""}
                    {h.steps ? ` · ${formatCount(h.steps)} steps` : ""}
                    {h.note ? ` · ${h.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditing(h)}
                    aria-label="Edit"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(h.id)}
                    aria-label="Delete"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EditCardioDialog
        entry={editing}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        onSaved={() => { setEditing(null); load(); }}
      />
    </div>
  );
}

function EditCardioDialog({ entry, onOpenChange, onSaved }) {
  const [type, setType] = useState("Walk");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [steps, setSteps] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setType(entry.type ?? "Walk");
      setDurationMinutes(entry.durationMinutes != null ? String(entry.durationMinutes) : "");
      setDistanceKm(entry.distanceKm != null ? String(entry.distanceKm) : "");
      setSteps(entry.steps != null ? String(entry.steps) : "");
      setNote(entry.note ?? "");
    }
  }, [entry]);

  if (!entry) return null;

  const save = async (e) => {
    e?.preventDefault?.();
    if (!durationMinutes && !distanceKm && !steps) {
      toast.error("Add duration, distance or steps");
      return;
    }
    setSaving(true);
    try {
      await GlobalApi.UpdateCardio({
        id: entry.id,
        type,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        distanceKm: distanceKm ? Number(distanceKm) : null,
        steps: steps ? Number(steps) : null,
        note: note.trim() || null,
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
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Edit cardio entry</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Type</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      type === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ec-duration">Duration (min)</Label>
                <Input
                  id="ec-duration"
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ec-distance">Distance (km)</Label>
                <Input
                  id="ec-distance"
                  type="number"
                  step="0.01"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ec-steps">Steps (optional)</Label>
              <Input
                id="ec-steps"
                type="number"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ec-note">Note (optional)</Label>
              <Input
                id="ec-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
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
