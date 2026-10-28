"use client";

import { useEffect, useState } from "react";
import { getEffectivePersonality, setPersonalityClient } from "@/lib/personality";

/**
 * Health animation overlay - the reward-layer "tally mark draws in" moment
 * from UX-PATTERNS.md §3. Mounted once in the dashboard layout; listens
 * for `etch:mark` CustomEvents fired by lib/etchFeedback.js etched() and
 * spawns an animated SVG slash in the bottom-right of the viewport.
 *
 * Animation timing is Personality-driven:
 *   - Calm   🍃 150ms stroke / 600ms fade   — barely-there
 *   - Steady 📓 300ms stroke / 1200ms fade  — default
 *   - Warm   🔥 400ms stroke / 1500ms fade  — full ritual
 *
 * Each mark carries its own timing in the event detail so the EtchAnimation
 * component doesn't need to re-read the preset on every fire. Calls
 * without a detail (legacy callers) fall back to Steady.
 *
 * Multiple rapid taps stack briefly: tapping +250 then +500 quickly will
 * show two slashes side-by-side for a moment, both fading on their own
 * timeline. Looks tactile, not glitchy.
 *
 * `pointer-events-none` so the overlay never blocks taps on the tile
 * grid underneath. `z-50` sits above the dashboard content but below
 * dialog modals / dropdown menus (which sit at z-100+ via shadcn).
 *
 * Honors `prefers-reduced-motion` automatically: the lib/personality.js
 * `getEffectivePersonality()` returns Calm when the OS media query is
 * set, so the inline-styled durations drop to the minimal preset
 * regardless of what's stored on the server.
 */
export default function EtchAnimation() {
  const [marks, setMarks] = useState([]);

  // One-time bootstrap: pull the server-stored personality preset into
  // localStorage so the reward layer reads the right value on this device
  // even when the user has never visited Settings here. Used the dashboard
  // layout because EtchAnimation is mounted globally; first visit on any
  // /dashboard route fires this fetch once. Background SWR-style mount;
  // we don't block the UI on failure.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user-context", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const row = await res.json();
        if (cancelled) return;
        setPersonalityClient(row?.personality ?? "steady");
      } catch {
        // Network blip — local default applies until next mount.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = (evt) => {
      const detail = evt?.detail;
      // Fall back to the live preset if the event didn't carry timings
      // (legacy callers, manual dispatch in dev).
      let strokeMs = detail?.strokeMs;
      let fadeMs = detail?.fadeMs;
      if (typeof strokeMs !== "number" || typeof fadeMs !== "number") {
        const preset = getEffectivePersonality();
        strokeMs = preset.animationStrokeMs;
        fadeMs = preset.animationFadeMs;
      }
      const id =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      setMarks((m) => [...m, { id, strokeMs, fadeMs }]);
      // Total animation life = max(strokeMs, fadeMs). Use the bigger of
      // the two so we don't unmount before either keyframe finishes.
      const ttl = Math.max(strokeMs, fadeMs) + 50;
      setTimeout(() => {
        setMarks((m) => m.filter((x) => x.id !== id));
      }, ttl);
    };
    window.addEventListener("etch:mark", handler);
    return () => window.removeEventListener("etch:mark", handler);
  }, []);

  if (marks.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-24 right-6 z-50 flex items-end gap-1 md:bottom-8"
      aria-hidden
    >
      {marks.map((m) => (
        <TallyMark key={m.id} strokeMs={m.strokeMs} fadeMs={m.fadeMs} />
      ))}
    </div>
  );
}

/**
 * One diagonal slash in ox-blood accent. Uses stroke-dasharray to draw
 * the line in via CSS animation. The full-element fade is layered as a
 * second animation on the outer span.
 *
 * Durations are pushed in via CSS custom properties so we can keep the
 * @keyframes generic (they reference var(--stroke-ms) / var(--fade-ms)).
 * Personality presets adjust both — Calm runs fast and quiet, Warm
 * lingers.
 */
function TallyMark({ strokeMs, fadeMs }) {
  return (
    <span
      className="animate-etch-fade"
      style={{
        animationDuration: `${fadeMs}ms`,
      }}
    >
      <svg
        width="22"
        height="36"
        viewBox="0 0 22 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          x1="3"
          y1="3"
          x2="19"
          y2="33"
          stroke="hsl(var(--primary))"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="animate-etch-stroke"
          style={{ animationDuration: `${strokeMs}ms` }}
        />
      </svg>
    </span>
  );
}
