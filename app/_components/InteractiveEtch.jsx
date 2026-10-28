"use client";

/**
 * The brand interaction, distilled to one widget.
 *
 * Etch's whole gesture is "tap once → a stroke is etched". Showing it
 * with copy alone is weaker than letting the visitor try it. This
 * widget renders an empty paper card with a "Tap to etch" cue; each
 * click adds a tally stroke that draws in via SVG stroke-dashoffset —
 * the same animation vocabulary the in-app etch uses. After five
 * strokes the diagonal crossing draws, completing a tally cluster,
 * and a small handwritten "etched." caption fades in. A reset button
 * lets the visitor play with it again.
 *
 * Honours prefers-reduced-motion: when set, strokes appear immediately
 * (no draw animation) but the click-to-add interaction still works.
 *
 * No external deps — pure SVG + CSS-in-JS for the dashoffset trick.
 */
import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

// Coordinates for the four vertical strokes + one diagonal crossing.
// Designed so each cluster reads as a single tally group at typical
// hero scale (60-72px tall).
const VERTICAL_STROKES = [
  { x: 16, y1: 12, y2: 60 },
  { x: 30, y1: 12, y2: 60 },
  { x: 44, y1: 12, y2: 60 },
  { x: 58, y1: 12, y2: 60 },
];
const DIAGONAL = { x1: 8, y1: 56, x2: 64, y2: 14 };

const STROKE_DRAW_MS = 320;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function InteractiveEtch() {
  const [count, setCount] = useState(0);
  const [touched, setTouched] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  // An empty dashed box reads as a broken placeholder, not an invitation.
  // So the paper writes its first two strokes itself shortly after mount
  // — the visitor sees the gesture happen, then gets handed the pen.
  // Any interaction before (or after) the timers cancels the choreography.
  useEffect(() => {
    if (touched) return;
    const t1 = setTimeout(() => setCount((c) => (c === 0 ? 1 : c)), 700);
    const t2 = setTimeout(() => setCount((c) => (c === 1 ? 2 : c)), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [touched]);

  const isComplete = count >= 5;
  // Single setState per click — earlier version used setCount(0) +
  // setTimeout(setCount(1), 220ms) which raced with subsequent rapid
  // taps. Setting count to 1 directly is simpler and the SVG
  // dashoffset transition handles the visual reset naturally.
  const handleTap = () => {
    setTouched(true);
    if (isComplete) {
      setCount(1);
      return;
    }
    setCount((n) => Math.min(5, n + 1));
  };

  const reset = (e) => {
    e?.stopPropagation();
    setTouched(true);
    setCount(0);
  };

  // Each stroke's stroke-dashoffset goes from full length (hidden) to 0
  // (fully drawn) over STROKE_DRAW_MS — same trick as EtchAnimation.jsx.
  const strokeLen = 48; // px — slightly longer than 12→60 to cover endpoints
  const diagLen = useMemo(() => {
    const dx = DIAGONAL.x2 - DIAGONAL.x1;
    const dy = DIAGONAL.y2 - DIAGONAL.y1;
    return Math.sqrt(dx * dx + dy * dy) + 4;
  }, []);

  const caption = !touched
    ? count === 0
      ? "Watch the paper."
      : "Your turn — tap the paper."
    : count === 0
    ? "Tap the paper to etch."
    : count < 5
    ? `${count} of 5.`
    : "etched.";

  return (
    <div
      className="relative inline-flex w-full max-w-xs select-none flex-col items-center gap-3 rounded-2xl bg-card/70 p-6 shadow-paper-1 paper-texture transition-shadow hover:shadow-paper-2"
      role="region"
      aria-label="Interactive tally-mark demo"
    >
      {/* The paper sheet itself. Click anywhere on the SVG to add a
          stroke. role="button" with explicit keyboard support so it's
          tab-reachable + Enter/Space activatable. */}
      <button
        type="button"
        onClick={handleTap}
        aria-label={
          isComplete
            ? "Reset and etch one stroke"
            : `Etch a stroke (${count} of 5)`
        }
        className="group relative flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/80 transition-all hover:border-primary/60 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.99]"
      >
        <svg
          viewBox="0 0 72 72"
          width="84"
          height="84"
          aria-hidden="true"
          className="overflow-visible"
        >
          {VERTICAL_STROKES.map((s, i) => {
            const visible = i < count;
            return (
              <line
                key={`v-${i}`}
                x1={s.x}
                y1={s.y1}
                x2={s.x}
                y2={s.y2}
                stroke="hsl(var(--foreground))"
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={strokeLen}
                strokeDashoffset={visible ? 0 : strokeLen}
                style={{
                  opacity: visible ? 1 : 0,
                  // Use the longhand transition-* properties everywhere
                  // (no `transition` shorthand) so React doesn't warn
                  // about mixing shorthand + longhand for the same
                  // property — that mismatch can lead to styling bugs.
                  transitionProperty: "stroke-dashoffset, opacity",
                  transitionDuration: reducedMotion
                    ? "0ms, 0ms"
                    : `${STROKE_DRAW_MS}ms, ${STROKE_DRAW_MS}ms`,
                  transitionTimingFunction:
                    "cubic-bezier(0.22, 1, 0.36, 1), ease-out",
                  // Slight stagger when multiple strokes appear at once
                  // (e.g. after reset). Single-tap adds one stroke so
                  // this only matters on reset → set-to-one sequence.
                  transitionDelay: visible ? `${i * 30}ms` : "0ms",
                }}
              />
            );
          })}

          {/* The diagonal crossing draws in only when the 5th stroke
              lands — completes the cluster. Drawn over the verticals so
              it visually "crosses" them. */}
          <line
            x1={DIAGONAL.x1}
            y1={DIAGONAL.y1}
            x2={DIAGONAL.x2}
            y2={DIAGONAL.y2}
            stroke="hsl(var(--primary))"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={diagLen}
            strokeDashoffset={isComplete ? 0 : diagLen}
            style={{
              opacity: isComplete ? 1 : 0,
              transitionProperty: "stroke-dashoffset, opacity",
              transitionDuration: reducedMotion ? "0ms, 0ms" : "420ms, 280ms",
              transitionTimingFunction:
                "cubic-bezier(0.22, 1, 0.36, 1), ease-out",
              transitionDelay: isComplete && !reducedMotion ? "80ms" : "0ms",
            }}
          />
        </svg>

        {/* Hover hint — fades in if the user hasn't tapped yet. */}
        {count === 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-1.5 right-2 font-handwritten text-[11px] text-primary/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            tap
          </span>
        )}
      </button>

      <div className="flex w-full items-center justify-between text-xs">
        <p
          aria-live="polite"
          className={
            isComplete
              ? "font-handwritten text-base text-primary"
              : "text-muted-foreground"
          }
        >
          {caption}
        </p>
        {touched && count > 0 && !isComplete && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Reset tally"
          >
            <RotateCcw className="h-3 w-3" />
            reset
          </button>
        )}
      </div>
    </div>
  );
}
