"use client";

import { useMemo } from "react";
import { Moon, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Sunday-evening weekly recap (UX-PATTERNS §"Closing the week").
 *
 * Only renders when:
 *   - Today is Sunday (local time)
 *   - Local time is past 18:00 (giving the day room to play out)
 *   - The user has logged at least one thing this week
 *
 * Otherwise returns null — quiet by default.
 *
 * Quiet on-brand summary card: counts the days this week with at
 * least one etched entry, surfaces a "X of 7 days. Sealed." line in
 * Source Serif italic, links to Trends for more detail.
 *
 * Props:
 *   - daysActive — number of days this week with at least one log (0..7)
 *   - streak     — current streak, used for tone of voice
 *
 * Render decision lives inside the component (Sunday + after 18:00 +
 * non-zero days) so the caller just renders it always; it self-mutes.
 */
export default function WeeklyRecapCard({ daysActive = 0, streak = 0 }) {
  // Compute the "should I show?" decision in a memo so we don't re-derive
  // on every render. Re-evaluates naturally when the page reloads at
  // midnight (useTodayDate handles the rollover).
  const show = useMemo(() => {
    if (daysActive === 0) return false;
    const now = new Date();
    if (now.getDay() !== 0) return false; // 0 = Sunday in JS
    if (now.getHours() < 18) return false;
    return true;
  }, [daysActive]);

  if (!show) return null;

  const headline =
    daysActive >= 6
      ? "A near-perfect week. Sealed."
      : daysActive >= 4
      ? "A solid week. Sealed."
      : daysActive >= 2
      ? "A few days logged this week."
      : "Quiet week, logged once.";

  return (
    <div className="rounded-2xl bg-primary/5 p-5 border border-foreground">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Moon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted-foreground">
            Sunday
          </p>
          <p className="mt-1 font-display uppercase text-xl font-bold leading-tight">
            {headline}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-mono font-bold tabular-nums text-foreground">
              {daysActive}
            </span>{" "}
            of 7 days logged this week
            {streak > 0 ? (
              <>
                {" "}
                ·{" "}
                <span className="font-mono font-bold tabular-nums text-foreground">
                  {streak}
                </span>{" "}
                day streak
              </>
            ) : null}
            .
          </p>
        </div>
        <Link
          href="/dashboard/me/trends"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          )}
        >
          Trends
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
