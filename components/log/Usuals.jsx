"use client";

import { cn } from "@/lib/utils";

/**
 * The shortcut buttons at the top of a log sheet: your containers, your
 * usual run, "Same as last". Each is a toggle button showing whether it
 * matches the value currently set.
 *
 * items: [{ key, label, sub?, on, onPick }]
 */
export default function Usuals({ label, items, columns }) {
  if (!items.length) return null;
  const cols = columns ?? Math.min(items.length, 3);
  return (
    <div role="group" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-pressed={!!it.on}
          onClick={it.onPick}
          className={cn(
            "flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-center",
            it.on ? "bg-foreground text-background" : "border border-foreground bg-card text-foreground"
          )}
        >
          <span className="text-[15px] font-bold leading-tight">{it.label}</span>
          {it.sub ? <span className="text-xs leading-tight opacity-80">{it.sub}</span> : null}
        </button>
      ))}
    </div>
  );
}
