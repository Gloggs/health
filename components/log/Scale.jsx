"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A row of joined choices, for feelings and quality: mood, energy, how you
 * slept, how a meal was. A radio group underneath, so arrow keys move the
 * choice and screen readers announce "Good, 4 of 5".
 *
 * options: [{ value, label, hint? }]
 */
export default function Scale({ label, options, value, onChange, tall = false, allowClear = true }) {
  const refs = useRef([]);
  const id = useId();
  const index = options.findIndex((o) => o.value === value);

  const pick = (v) => onChange(allowClear && v === value ? null : v);

  const onKeyDown = (e, i) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-semibold">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="grid border border-foreground"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (index === -1 && i === 0) ? 0 : -1}
              onClick={() => pick(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-1 text-sm",
                tall ? "h-16" : "h-12",
                i > 0 && "border-l border-foreground",
                on ? "bg-foreground font-bold text-background" : "bg-card font-semibold text-foreground"
              )}
            >
              {o.hint != null ? <span className="font-display text-xl font-bold leading-none">{o.hint}</span> : null}
              <span className={o.hint != null ? "text-xs" : undefined}>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
