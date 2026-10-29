"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline error fallback for places where the page itself loaded but a
 * specific section's data failed (an API blip, a 503, etc). Different
 * from app/error.js which catches uncaught render errors.
 *
 * Branded — paper background, ox-blood accent on the alert icon, voiced
 * recovery copy. Single optional retry CTA.
 *
 * Use:
 *   <ErrorState message="Couldn't load family." onRetry={mutate} />
 *
 *   <ErrorState
 *     title="The chart didn't load"
 *     message="Network blip. Try again in a moment."
 *     onRetry={refetch}
 *   />
 *
 *   <ErrorState compact message="Couldn't save" />   // smaller, inline
 */
export default function ErrorState({
  title = "Something didn't land",
  message,
  onRetry,
  compact = false,
  className = "",
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 text-center",
        compact ? "px-4 py-4" : "px-6 py-8",
        className
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <p className="font-display uppercase text-base font-semibold text-destructive">
        {title}
      </p>
      {message ? (
        <p className="max-w-sm text-sm leading-relaxed text-foreground/80">
          {message}
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-card px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Try again
        </button>
      ) : null}
    </div>
  );
}
