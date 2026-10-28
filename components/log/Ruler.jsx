"use client";

import { useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const TICK = 12; // px between ticks
const SIDE = 16; // ticks drawn either side of the centre

function roundTo(value, step) {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

/**
 * A swipe ruler for numbers: weight, water, minutes, distance.
 *
 * Drag or swipe sideways, scroll, use the arrow keys, or press the - and +
 * buttons. It is a real slider to assistive tech (role="slider" with
 * aria-valuetext), so it reads as "78.4 kg" rather than a row of lines.
 */
export default function Ruler({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  majorEvery = 10,
  format = (v) => String(v),
  className,
}) {
  const drag = useRef(null);
  const wheel = useRef(0);

  const set = (next) => {
    const v = Math.min(max, Math.max(min, roundTo(next, step)));
    if (v !== value) onChange(v);
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, start: value };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    // Dragging left brings bigger numbers to the centre, like a tape measure.
    const steps = Math.round((drag.current.x - e.clientX) / TICK);
    set(drag.current.start + steps * step);
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (e) => {
    wheel.current += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const steps = Math.trunc(wheel.current / 30);
    if (steps) {
      wheel.current -= steps * 30;
      set(value + steps * step);
    }
  };
  const onKeyDown = (e) => {
    const big = step * majorEvery;
    const map = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    };
    if (e.key in map) {
      e.preventDefault();
      set(map[e.key]);
    }
  };

  const ticks = [];
  for (let i = -SIDE; i <= SIDE; i++) {
    const v = roundTo(value + i * step, step);
    if (v < min || v > max) continue;
    const major = Math.round(v / step) % majorEvery === 0;
    ticks.push({ i, v, major });
  }

  return (
    <div className={cn("grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => set(value - step)}
        aria-label={`Less ${label.toLowerCase()}`}
        className="flex h-14 items-center justify-center border border-foreground bg-card text-foreground"
      >
        <Minus className="h-5 w-5" aria-hidden />
      </button>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className="relative h-14 cursor-ew-resize touch-none select-none overflow-hidden border border-foreground bg-card"
      >
        {ticks.map(({ i, v, major }) => (
          <div
            key={v}
            aria-hidden
            className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `calc(50% + ${i * TICK}px)` }}
          >
            {major ? (
              <span className="mb-1 whitespace-nowrap text-[10px] text-muted-foreground">{format(v)}</span>
            ) : null}
            <span className={cn("w-px bg-foreground", major ? "h-6 w-0.5" : "h-3")} />
          </div>
        ))}
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-flame" />
      </div>
      <button
        type="button"
        onClick={() => set(value + step)}
        aria-label={`More ${label.toLowerCase()}`}
        className="flex h-14 items-center justify-center border border-foreground bg-card text-foreground"
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
