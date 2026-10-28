import { cn } from "@/lib/utils";

/**
 * Single container shape for every dashboard surface. Replaces the 6+
 * different `mx-auto max-w-* p-* space-y-*` combos that grew up across
 * pages. Three width variants matching the audit recommendation:
 *
 *   - "hero"     — Today, Family, Train. Generous (max-w-7xl), the
 *                  big-screen surfaces.
 *   - "hub"      — Log hub, Me hub. Medium (max-w-5xl). Browsing density.
 *   - "reading"  — Chat, Settings, Trends, Me sub-pages, Reminders.
 *                  Single-column (max-w-3xl). Reading + form surfaces.
 *
 * Spacing rhythm is also baked in:
 *   - Page padding: p-4 sm:p-6 (16 mobile, 24 desktop)
 *   - Section gap:  space-y-6 (24px)
 *
 * Use:
 *   <PageShell variant="hero">
 *     <PageHero ... />
 *     ... sections ...
 *   </PageShell>
 *
 * Drops in as a replacement for the bare `<div className="space-y-6 p-4 md:p-6">`
 * wrapper most pages currently use.
 */
const WIDTHS = {
  hero: "max-w-7xl",
  hub: "max-w-5xl",
  reading: "max-w-3xl",
};

export default function PageShell({
  variant = "hero",
  className,
  children,
  noGap = false,
}) {
  return (
    <div
      className={cn(
        "mx-auto p-4 sm:p-6",
        WIDTHS[variant] ?? WIDTHS.hero,
        noGap ? "" : "space-y-6",
        className
      )}
    >
      {children}
    </div>
  );
}
