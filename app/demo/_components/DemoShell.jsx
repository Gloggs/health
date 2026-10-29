"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/shell/AppShell";
import { resetStore } from "../_mock/store";
import { cn } from "@/lib/utils";

const MODE_KEY = "etch-demo-mode";

// The demo strip: says this is sample data, switches between a family of
// seven and one person, resets, and points to a real account.
function DemoBanner() {
  const [mode, setMode] = useState("family");

  useEffect(() => {
    try {
      setMode(window.sessionStorage.getItem(MODE_KEY) === "solo" ? "solo" : "family");
    } catch {
      // Storage blocked: stay on the family demo.
    }
  }, []);

  const switchMode = (next) => {
    if (next === mode) return;
    try {
      window.sessionStorage.setItem(MODE_KEY, next);
    } catch {
      // Ignore; the URL carries the mode anyway.
    }
    window.location.href = "/demo?mode=" + next;
  };

  const reset = () => {
    resetStore();
    window.location.reload();
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-flame px-3 py-1.5 text-ink sm:px-4">
      <p className="text-sm font-semibold">Demo on sample data. Nothing is saved.</p>
      <div className="flex items-center gap-1.5">
        <div role="group" aria-label="Demo household" className="flex border border-ink">
          {[
            ["family", "Family"],
            ["solo", "Just me"],
          ].map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              className={cn("h-8 px-2.5 text-xs font-semibold", mode === m ? "bg-ink text-chalk" : "text-ink")}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={reset} className="h-8 px-2 text-xs font-semibold underline underline-offset-2">
          Reset
        </button>
        <Link href="/request-invite" className="flex h-8 items-center bg-ink px-2.5 text-xs font-bold text-chalk">
          Request an invite
        </Link>
      </div>
    </div>
  );
}

export default function DemoShell({ children }) {
  return (
    <AppShell base="/demo" user={{ name: "You", initials: "Y" }} signOut={null} banner={<DemoBanner />}>
      {children}
    </AppShell>
  );
}
