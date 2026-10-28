"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Scale, Save, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { todayDateStr, daysAgoStr, prettyDate } from "@/lib/dates";
import { formatWeight } from "@/lib/format";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHeader from "../../_components/PageHeader";
import EmptyState from "../../_components/states/EmptyState";

function safeDateParam(raw, today) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
}

// Weight is the primary tracker — daily for most users, charts surface
// the trend, this is the one number that actually gets logged often. The
// other five measurements are slower-changing (most people remeasure
// monthly at most) and lived behind a "More measurements" expander since
// E.4. Following UX-PATTERNS §7: progressive disclosure, never multi-step.
const PRIMARY_FIELD = { key: "weightKg", label: "Weight (kg)", step: "0.1" };
const MORE_FIELDS = [
  { key: "waistCm", label: "Waist (cm)", step: "0.1" },
  { key: "chestCm", label: "Chest (cm)", step: "0.1" },
  { key: "armsCm", label: "Arms (cm)", step: "0.1" },
  { key: "hipsCm", label: "Hips (cm)", step: "0.1" },
  { key: "thighsCm", label: "Thighs (cm)", step: "0.1" },
];
const FIELDS = [PRIMARY_FIELD, ...MORE_FIELDS];

export default function BodyPage() {
  return (
    <Suspense fallback={null}>
      <BodyPageInner />
    </Suspense>
  );
}

function BodyPageInner() {
  const today = todayDateStr();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(() => safeDateParam(searchParams.get("date"), today));
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const [history, setHistory] = useState(null);
  const [saving, setSaving] = useState(false);
  // Tracks which fields were seeded from yesterday-as-default vs. left
  // blank vs. came from an existing row for `date`. Used to show the
  // "pre-filled from last reading" hint near affected inputs.
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const load = () => {
    Promise.all([
      GlobalApi.GetBody({ from: date, to: date }),
      GlobalApi.GetBody({ from: daysAgoStr(90), to: today }),
    ]).then(([cur, hist]) => {
      const existing = cur.data?.[0];
      const histRows = hist.data ?? [];
      if (existing) {
        const next = {};
        FIELDS.forEach((f) => { next[f.key] = existing[f.key] ?? ""; });
        setForm(next);
        setNote(existing.note ?? "");
        setDefaultsApplied(false);
      } else {
        // Yesterday-as-default (UX-PATTERNS §2): pre-fill weight from the
        // most-recent body row. Measurements (waist/chest/arms/hips/
        // thighs) stay blank because they change slowly enough that a
        // stale default would lie — the user would forget to override
        // and the trend would look flat. Weight changes day-to-day, so
        // a recent reading is a useful starting point.
        const recent = histRows[0];
        if (recent && recent.weightKg != null) {
          setForm({ weightKg: String(recent.weightKg) });
          setDefaultsApplied(true);
        } else {
          setForm({});
          setDefaultsApplied(false);
        }
        setNote("");
      }
      setHistory(histRows);
    });
  };

  // Patch a single field. Clears the defaults-applied flag the moment
  // the user touches anything seeded.
  const patchField = (key, value) => {
    setForm((s) => ({ ...s, [key]: value }));
    setDefaultsApplied(false);
  };

  // Auto-expand the "More measurements" panel whenever the loaded row
  // already has any of those fields filled in. Avoids hiding existing
  // data behind a closed drawer when the user comes back to edit.
  const hasMore = MORE_FIELDS.some(
    (f) => form[f.key] != null && form[f.key] !== ""
  );
  const [showMore, setShowMore] = useState(false);
  useEffect(() => {
    if (hasMore) setShowMore(true);
  }, [hasMore]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [date]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { date, note: note.trim() || null };
      FIELDS.forEach((f) => {
        const v = form[f.key];
        payload[f.key] = v === "" || v === undefined ? null : Number(v);
      });
      await GlobalApi.SaveBody(payload);
      toast.success("Saved");
      load();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await GlobalApi.DeleteBody(id);
      load();
    } catch {
      toast.error("Failed to remove");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        fallback="/dashboard/log"
        icon={Scale}
        title="Body"
        subtitle="Weight weekly, measurements monthly."
      />

      <div className="rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Log for</p>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        </div>

        {/* Primary field — always visible. Weight is what gets logged
            daily; the rest live behind "More measurements" because most
            people remeasure those once a month. UX-PATTERNS §7. */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {PRIMARY_FIELD.label}
          </label>
          <Input
            type="number"
            step={PRIMARY_FIELD.step}
            value={form[PRIMARY_FIELD.key] ?? ""}
            onChange={(e) => patchField(PRIMARY_FIELD.key, e.target.value)}
            className="h-12 text-lg tabular-nums"
            autoFocus
          />
          {defaultsApplied ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Pre-filled from your last reading. Adjust before saving.
            </p>
          ) : null}
        </div>

        {/* Expand-in-place for the slower measurements. Auto-opens when
            the loaded row already has any of these set, so editing past
            entries doesn't hide existing data. */}
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {showMore ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Hide measurements
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> More measurements
              <span className="text-[10px] text-muted-foreground/70">
                · waist · chest · arms · hips · thighs
              </span>
            </>
          )}
        </button>

        {showMore ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {MORE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground">
                  {f.label}
                </label>
                <Input
                  type="number"
                  step={f.step}
                  value={form[f.key] ?? ""}
                  onChange={(e) => patchField(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          <Input placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Etching…" : "Etch it"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Last 90 days</p>
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
                  <p className="text-sm font-medium">{prettyDate(h.date)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.weightKg ? formatWeight(h.weightKg) : "-"}
                    {h.waistCm ? ` · waist ${h.waistCm}` : ""}
                    {h.chestCm ? ` · chest ${h.chestCm}` : ""}
                    {h.armsCm ? ` · arms ${h.armsCm}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => remove(h.id)}
                  className="text-destructive transition-colors hover:underline"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
