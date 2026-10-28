"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Moon,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { etched } from "@/lib/etchFeedback";
import { getEffectivePersonality } from "@/lib/personality";
import GlobalApi from "@/app/_services/GlobalApi";

/**
 * Close-the-day ritual card (UX-PATTERNS.md §5).
 *
 * Sits below the Today check-in section. Two visual states:
 *
 *   1. OPEN  — shows "X of 7 etched today" + a "Close today" button.
 *              Tapping the button optionally expands an inline note
 *              field, then confirms = stamps `closedAt` in DB.
 *   2. CLOSED — shows "Closed at HH:MM" + the note (if any) + a quiet
 *              "Reopen" link. Card visually settles into a sealed state.
 *
 * Visibility logic on the OPEN state is Personality-driven:
 *   - Calm  🍃 — never auto-prompts. Card is always visible on Today
 *              so user can find it by scroll, but no nightly nudge.
 *   - Steady 📓 — soft prompt visible after 21:00 local time.
 *   - Warm   🔥 — prompt visible after 20:00.
 *
 * The card itself is always rendered (so users can close any time);
 * the Personality preset just controls the visual emphasis — the
 * "nudge" banner above the count appears only after the prompt time.
 *
 * Props:
 *   - count        — number of trackers logged today (0..7)
 *   - total        — denominator for the "X of N" line (default 7)
 *   - closedAt     — ISO string from DAILY_CHECK_INS.closedAt, or null
 *   - note         — existing note text, if any
 *   - date         — YYYY-MM-DD for the row we're stamping
 *   - onChanged()  — parent SWR mutate hook
 */
export default function CloseTodayCard({
  count = 0,
  total = 7,
  closedAt,
  note,
  date,
  onChanged,
}) {
  const isClosed = !!closedAt;
  const [expanding, setExpanding] = useState(false);
  const [noteDraft, setNoteDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  // Re-read preset on `etch:personality-changed` so swapping in Settings
  // immediately changes whether the nightly nudge banner shows.
  const [preset, setPreset] = useState(() => getEffectivePersonality());
  useEffect(() => {
    const re = () => setPreset(getEffectivePersonality());
    window.addEventListener("etch:personality-changed", re);
    return () => window.removeEventListener("etch:personality-changed", re);
  }, []);

  useEffect(() => {
    if (!expanding) setNoteDraft(note ?? "");
  }, [note, expanding]);

  // Decide whether to surface the nightly nudge banner. The card is
  // always present; this just controls the "the day's nearly closed"
  // affordance above the count.
  const showNudge = useMemo(() => {
    if (isClosed) return false;
    const promptTime = preset?.closeDayPromptTime;
    if (!promptTime) return false; // Calm — never auto-nudge
    const [h, m] = promptTime.split(":").map(Number);
    const now = new Date();
    const promptDate = new Date();
    promptDate.setHours(h, m, 0, 0);
    return now >= promptDate;
  }, [preset, isClosed]);

  const closeNow = async () => {
    setSaving(true);
    try {
      await GlobalApi.SaveCheckIn({
        date,
        closedAt: true,
        note: noteDraft.trim() || null,
      });
      // Slower, more deliberate etch — the close-day stroke is meant to
      // feel weightier than a quick water tap. We bump the message to
      // match. The animation duration is still preset-driven.
      etched({ message: "Today, etched." });
      setExpanding(false);
      onChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    setSaving(true);
    try {
      await GlobalApi.SaveCheckIn({ date, closedAt: false });
      toast.success("Day reopened");
      onChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (isClosed) {
    const closedTime = new Date(closedAt);
    const hhmm = closedTime.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 shadow-paper-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
                Closed
              </p>
              <p className="mt-0.5 font-serif text-xl font-bold leading-tight">
                Today, etched.
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                Closed at {hhmm}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reopen}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Reopen
          </button>
        </div>
        {note ? (
          <p className="mt-3 rounded-lg border border-dashed border-primary/30 bg-card/60 p-3 text-sm leading-relaxed">
            {note}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl bg-card/70 p-5 shadow-paper-1 paper-texture transition-colors",
        showNudge && "border-primary/40 bg-primary/[0.04]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Moon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {showNudge ? "The day's nearly closed" : "Close today"}
          </p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="font-mono text-2xl font-bold leading-none tabular-nums">
              {count}
            </p>
            <p className="text-xs text-muted-foreground">
              of {total} etched today
            </p>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {showNudge
              ? "A quiet moment to seal what you did. Tap below when you're ready — no rush."
              : "When you're done for the day, seal it. No fanfare. Just a quieter line under today."}
          </p>
        </div>
      </div>

      {!expanding ? (
        <button
          type="button"
          onClick={() => setExpanding(true)}
          className={cn(
            "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
            showNudge
              ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
              : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04]"
          )}
        >
          <Sparkles className="h-4 w-4" />
          Close today
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      ) : (
        <div className="mt-4 space-y-2">
          <label htmlFor="close-note" className="text-[11px] text-muted-foreground">
            One line on today (optional)
          </label>
          <textarea
            id="close-note"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value.slice(0, 240))}
            rows={2}
            autoFocus
            placeholder="e.g. Quiet day, good walk. Mum still poorly."
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setExpanding(false);
                setNoteDraft(note ?? "");
              }}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <ChevronUp className="mr-0.5 inline h-3 w-3" /> Cancel
            </button>
            <button
              type="button"
              onClick={closeNow}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                  Sealing…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  Seal today
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
