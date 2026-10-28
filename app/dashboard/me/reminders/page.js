"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Plus,
  Trash2,
  Droplet,
  Utensils,
  Dumbbell,
  Footprints,
  Scale,
  Moon,
  Pill,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHeader from "../../_components/PageHeader";
import EmptyState from "../../_components/states/EmptyState";

const KINDS = [
  { key: "water", label: "Water", icon: Droplet },
  { key: "meal", label: "Meal", icon: Utensils },
  { key: "workout", label: "Workout", icon: Dumbbell },
  { key: "walk", label: "Walk", icon: Footprints },
  { key: "weighin", label: "Weigh-in", icon: Scale },
  { key: "winddown", label: "Wind-down", icon: Moon },
  { key: "supplement", label: "Supplement", icon: Pill },
];

const ICON_FOR = Object.fromEntries(KINDS.map((k) => [k.key, k.icon]));

export default function RemindersPage() {
  const [items, setItems] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kind: "water", label: "", schedule: "", channel: "push" });

  const load = () => GlobalApi.GetReminders().then((r) => setItems(r.data ?? []));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.label.trim()) {
      toast.error("Label required");
      return;
    }
    setAdding(true);
    try {
      await GlobalApi.CreateReminder({
        kind: form.kind,
        label: form.label.trim(),
        schedule: form.schedule.trim() || null,
        channel: form.channel,
        enabled: true,
      });
      setForm({ kind: "water", label: "", schedule: "", channel: "push" });
      load();
      toast.success("Reminder added");
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (item) => {
    try {
      await GlobalApi.UpdateReminder({ id: item.id, enabled: !item.enabled });
      load();
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed";
      toast.error(msg);
    }
  };

  const remove = async (id) => {
    try {
      await GlobalApi.DeleteReminder(id);
      load();
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        fallback="/dashboard/me"
        icon={Bell}
        title="Reminders"
        subtitle="Queue them up. Delivery wires in later."
      />

      {/* Honest banner: configuration works now, delivery doesn't yet.
          Lets the user build their reminder list ahead of time instead of
          waiting for push / calendar integration to be done first. */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Info className="h-4 w-4 text-primary" />
          Configure now, delivery comes later
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          You can add, toggle and delete reminders here today. Push and Google Calendar
          delivery aren't connected yet, so nothing will buzz on your phone - but your list
          is saved and will start firing the moment delivery ships.
        </p>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
          New reminder
        </p>

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, kind: key }))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    form.kind === key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Label</p>
            <Input
              placeholder="e.g. Vitamin D"
              value={form.label}
              onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
              maxLength={80}
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Schedule (free text)</p>
            <Input
              placeholder="e.g. daily 09:00, every 2h 09:00-21:00, Mon Wed Fri 18:00"
              value={form.schedule}
              onChange={(e) => setForm((s) => ({ ...s, schedule: e.target.value }))}
              maxLength={80}
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Delivery channel</p>
            <div className="flex gap-1.5">
              {["push", "calendar", "both"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, channel: c }))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                    form.channel === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={create} disabled={adding || !form.label.trim()}>
            <Plus className="mr-1.5 h-4 w-4" /> {adding ? "Adding…" : "Add reminder"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items === null ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : items.length === 0 ? (
          <EmptyState compact title="nothing queued yet" body="Add one above, water, meals, weigh-ins, supplements." />
        ) : (
          items.map((r) => {
            const Icon = ICON_FOR[r.kind] ?? Bell;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-paper-1 paper-texture"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.schedule ?? "no schedule"} · {r.channel}
                  </p>
                </div>
                <button
                  onClick={() => toggle(r)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    r.enabled
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {r.enabled ? "On" : "Off"}
                </button>
                <button
                  onClick={() => remove(r.id)}
                  className="text-destructive transition-colors hover:underline"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
