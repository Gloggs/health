/**
 * Reward-layer helpers for tap-to-etch interactions.
 *
 * UX-PATTERNS.md §1 (one-tap-and-done) + §3 (etch animation) prescribe
 * a small reward whenever an entry lands: haptic ping + on-voice toast,
 * optionally with an Undo affordance for the next 3 seconds. This file
 * is the single place that defines what "etched" feels like, so tweaking
 * Personality presets later (Calm/Steady/Warm) means changing one file.
 *
 * Design notes:
 *   - sonner is already in the root layout, so toast just works.
 *   - Vibration API is broadly supported on Android Chrome / Firefox.
 *     iOS Safari refuses without a Capacitor wrapper - we silently
 *     no-op instead of polyfilling. When G.2 ships the iOS native
 *     shell, swap navigator.vibrate for Haptics.impact() (Capacitor).
 */

"use client";

import { toast } from "sonner";
import { getEffectivePersonality } from "@/lib/personality";

/**
 * Subtle haptic ping. ~15ms on supported devices, tuned by intensity.
 *
 *   etchHaptic()           // default subtle thump
 *   etchHaptic("warm")     // slightly more bite
 *   etchHaptic("ghost")    // barely there
 *
 * When called without an intensity arg, falls back to the user's
 * Personality preset (Calm = ghost, Steady = subtle, Warm = warm).
 */
export function etchHaptic(intensity) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  const preset = getEffectivePersonality();
  if (!preset.hapticEnabled) return;
  const effective = intensity ?? preset.hapticIntensity ?? "subtle";
  const ms = effective === "warm" ? 25 : effective === "ghost" ? 8 : 15;
  try {
    navigator.vibrate(ms);
  } catch {
    // Some Android versions throw if user-gesture grace expired.
    // Silently swallow - vibration is decoration, not function.
  }
}

/**
 * On-brand "did the thing" toast. Voice rules per BRAND.md §5 - direct,
 * specific, no exclamation marks, no emoji. Caller supplies the message
 * text already shaped to voice (e.g. "250 ml etched", "+10 press-ups
 * etched", not "Logged successfully!").
 *
 *   etchToast("250 ml etched");
 *   etchToast("250 ml etched", { onUndo: () => removeLast() });
 *   etchToast("250 ml etched", { onUndo, durationMs: 5000 });
 */
export function etchToast(message, { onUndo, durationMs = 3000 } = {}) {
  toast.success(message, {
    duration: durationMs,
    ...(onUndo
      ? {
          action: {
            label: "Undo",
            onClick: () => onUndo(),
          },
        }
      : {}),
  });
}

/**
 * One call for the common case - haptic + toast + tally-mark animation
 * in one go. Picks animation duration + haptic intensity from the user's
 * current Personality preset (Calm/Steady/Warm), with explicit overrides
 * available for special-case callers.
 *
 *   etched({ message: "250 ml etched", onUndo: removeLast })
 *   etched({ message: "+10 press-ups etched" })          // no undo
 *   etched({ haptic: "ghost", message: "etched" })        // force calm
 *
 * The fired CustomEvent carries the preset's stroke/fade timings so
 * EtchAnimation.jsx can size the SVG draw-in correctly without re-
 * reading localStorage on every event.
 */
export function etched({ message, onUndo, haptic } = {}) {
  etchHaptic(haptic);
  if (message) etchToast(message, { onUndo });
  if (typeof window !== "undefined") {
    const preset = getEffectivePersonality();
    window.dispatchEvent(
      new CustomEvent("etch:mark", {
        detail: {
          strokeMs: preset.animationStrokeMs,
          fadeMs: preset.animationFadeMs,
        },
      })
    );
  }
}

/**
 * Stronger reward layer for streak milestones — fires when the streak
 * lands on a meaningful number (7, 30, 100, 365). Doubles the etch
 * animation duration, fires haptic + a toast with the milestone copy,
 * and stamps a localStorage marker so we don't re-fire on every render
 * the same day.
 *
 *   maybeFireStreakMilestone(streak)
 *
 * Called from the Today page after `streak` is computed. No-ops on
 * non-milestone numbers and on days we already celebrated.
 */
const MILESTONES = [7, 14, 30, 60, 100, 200, 365, 500, 1000];
const MILESTONE_KEY = "etch.streakMilestone.lastFired.v1";

function milestoneCopy(n) {
  if (n === 7) return "A week. Etched.";
  if (n === 14) return "Two weeks. Etched.";
  if (n === 30) return "30 days. Etched.";
  if (n === 60) return "60 days. Etched.";
  if (n === 100) return "100 days. Etched.";
  if (n === 200) return "200 days. Etched.";
  if (n === 365) return "A year. Etched.";
  if (n === 500) return "500 days. Etched.";
  if (n === 1000) return "A thousand days. Etched.";
  return `${n} days. Etched.`;
}

export function maybeFireStreakMilestone(streak) {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(streak) || streak <= 0) return;
  if (!MILESTONES.includes(streak)) return;

  // Don't re-fire the same milestone on the same day across re-renders.
  // Key the marker by (streak, YYYY-MM-DD).
  const today = new Date().toISOString().slice(0, 10);
  const marker = `${streak}@${today}`;
  let last = null;
  try {
    last = window.localStorage.getItem(MILESTONE_KEY);
  } catch {
    /* private mode — celebrate anyway */
  }
  if (last === marker) return;
  try {
    window.localStorage.setItem(MILESTONE_KEY, marker);
  } catch {
    /* swallow */
  }

  // Fire a weightier etch: stronger haptic, double-duration animation,
  // milestone toast. The toast is on-voice — no "you smashed it!"
  // exclamations. Just the fact of the day.
  etchHaptic("warm");
  toast.success(milestoneCopy(streak), {
    duration: 6000,
  });
  const preset = getEffectivePersonality();
  window.dispatchEvent(
    new CustomEvent("etch:mark", {
      detail: {
        strokeMs: preset.animationStrokeMs * 2,
        fadeMs: preset.animationFadeMs * 1.5,
      },
    })
  );
}
