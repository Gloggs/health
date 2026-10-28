"use client";

import { useRef } from "react";
import { addDays, dateStr, todayDateStr } from "@/lib/dates";

/**
 * The date button at the top of a log sheet. Starts as today; tapping it
 * opens the phone's own date picker so backdating is one tap away.
 * `todayLabel` lets sleep say "Last night" instead of "Today".
 */
export default function WhenPicker({ value, onChange, todayLabel = "Today", yesterdayLabel = "Yesterday" }) {
  const input = useRef(null);
  const today = todayDateStr();
  const yesterday = dateStr(addDays(new Date(), -1));

  let label;
  if (value === today) label = todayLabel;
  else if (value === yesterday) label = yesterdayLabel;
  else {
    const d = new Date(`${value}T12:00:00`);
    label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }

  const open = () => {
    const el = input.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // Some browsers refuse showPicker outside a direct gesture; fall back.
      }
    }
    el.focus();
    el.click();
  };

  return (
    <span className="relative">
      <button
        type="button"
        onClick={open}
        aria-label={`Date: ${label}. Change date`}
        className="h-9 border border-foreground bg-card px-2.5 text-sm font-semibold text-foreground"
      >
        {label}
      </button>
      <input
        ref={input}
        type="date"
        value={value}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </span>
  );
}
