"use client";

import { cn } from "@/lib/utils";

/**
 * Top-level page hero for every sidebar surface. Lands the "paper journal"
 * brand language from G.3 / BRAND.md across the app:
 *
 *   - Caveat handwritten "eyebrow" (the page tag — "train", "log", etc.)
 *     in muted ink, lowercase, margin-note feel.
 *   - Source Serif headline below, display-scale, tight tracking.
 *   - Optional plain-text subtitle in muted body-sans.
 *   - Optional right-rail slot (range pickers, tabs, action buttons).
 *   - Single hand-drawn wavy rule beneath the whole block as the divider.
 *
 * Distinct from the older `PageHeader.jsx` component which is for SUB-
 * pages (it has a back arrow + icon tile, made for log/sleep, log/cardio
 * etc). PageHero is for the top-level sidebar routes that don't need a
 * back arrow because the sidebar IS the navigation.
 *
 * Usage:
 *
 *   <PageHero
 *     eyebrow="train"
 *     title="Your training side"
 *     subtitle="Weekly plan, exercise library, and the last few sessions you logged."
 *   />
 *
 *   <PageHero
 *     eyebrow="trends"
 *     title="Trends"
 *     subtitle="Everything you've logged, visualised. No AI required."
 *     right={<RangePicker ... />}
 *   />
 *
 * Props:
 *   - eyebrow   — short Caveat tag above the title. Lowercase by convention.
 *   - title     — the page name. Source Serif bold.
 *   - subtitle  — one-line description in body-sans muted.
 *   - right     — optional React node rendered top-right (range pickers,
 *                 settings cogs, etc.). Wrap-friendly so it drops under
 *                 the title on narrow screens.
 *   - className — extra classes on the outer block (rare; usually unused).
 *   - children  — optional content slot rendered below the rule. Use for
 *                 things that sit "in the hero area" but aren't subtitle
 *                 (e.g. the Family page's roster summary line).
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  right,
  className,
  children,
}) {
  return (
    <div className={cn("rule-handdrawn enter-paper pt-2 pb-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="font-handwritten text-xl leading-none text-primary/80">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "font-serif font-bold tracking-tight",
              // Fluid clamp 30→40px via tailwind.config — no breakpoint jump.
              "text-page-title",
              eyebrow ? "mt-2" : ""
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? (
          <div className="flex shrink-0 items-center gap-2">{right}</div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
