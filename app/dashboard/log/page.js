"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useLog } from "@/components/log/LogProvider";

// Every kind of log in one list. The row opens its history; the button on
// the right opens the log sheet straight away.
const ROWS = [
  { kind: "sleep", label: "Sleep", detail: "Bedtime, wake time, how you slept", href: "/dashboard/log/sleep" },
  { kind: "water", label: "Water", detail: "Your containers, day total", href: "/dashboard/log/water" },
  { kind: "weight", label: "Weight and body", detail: "Weight, measurements", href: "/dashboard/log/body" },
  { kind: "cardio", label: "Cardio", detail: "Walks, runs, rides, swims", href: "/dashboard/log/cardio" },
  { kind: "meal", label: "Meals", detail: "Breakfast, lunch, dinner, snacks", href: "/dashboard/log/meals" },
  { kind: "mood", label: "Mood and energy", detail: "How you feel, and what played a part", href: "/dashboard/log/mood" },
];

export default function LogHubPage() {
  const { openLog } = useLog();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none">Log</h1>

      <ul className="border border-border bg-card">
        {ROWS.map((r) => (
          <li key={r.kind} className="flex items-center border-b border-border last:border-b-0">
            <Link href={r.href} className="flex min-h-[64px] min-w-0 flex-1 items-center gap-2 px-4 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[17px] font-semibold">{r.label}</span>
                <span className="truncate text-sm text-muted-foreground">{r.detail}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => openLog(r.kind)}
              aria-label={`Log ${r.label.toLowerCase()}`}
              className="mr-3 h-10 border border-foreground px-4 text-sm font-semibold"
            >
              Log
            </button>
          </li>
        ))}
        <li className="flex items-center">
          <Link href="/dashboard/journal" className="flex min-h-[64px] min-w-0 flex-1 items-center gap-2 px-4 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[17px] font-semibold">Journal</span>
              <span className="truncate text-sm text-muted-foreground">Private. Only you can read it.</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      </ul>
    </div>
  );
}
