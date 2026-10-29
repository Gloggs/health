import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shape-matched loading skeletons. Replaces ad-hoc <Skeleton/> rectangles
 * scattered across the app with a single primitive that knows the
 * surface it's standing in for, so loading reads like "the real content
 * is on the way" rather than a generic grey bar.
 *
 * Shapes:
 *   - "tile"   — one of the Today tiles (Sleep/Water/Mood/etc.)
 *   - "card"   — a section card with header + body
 *   - "row"    — a list row (Family member, history item, etc.)
 *   - "header" — page hero (eyebrow + title + subtitle)
 *   - "chart"  — Trends chart card
 *
 * Use:
 *   <LoadingState shape="tile" count={4} />
 *   <LoadingState shape="card" />
 *   <LoadingState shape="row" count={3} />
 */
export default function LoadingState({ shape = "card", count = 1, className = "" }) {
  const items = Array.from({ length: count });

  if (shape === "tile") {
    return (
      <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", className)}>
        {items.map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card p-4"
            aria-hidden="true"
          >
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="mt-3 h-3 w-16" />
            <Skeleton className="mt-2 h-7 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (shape === "row") {
    return (
      <ul className={cn("space-y-2", className)}>
        {items.map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-xl bg-card p-3"
            aria-hidden="true"
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (shape === "header") {
    return (
      <div className={cn("space-y-2 pt-2 pb-5", className)} aria-hidden="true">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
    );
  }

  if (shape === "chart") {
    return (
      <div
        className={cn(
          "border border-foreground bg-card p-5  sm:p-6",
          className
        )}
        aria-hidden="true"
      >
        <div className="mb-5 flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  // "card" default
  return (
    <div className={cn("space-y-3", className)}>
      {items.map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-card p-5 shadow-paper-1"
          aria-hidden="true"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
