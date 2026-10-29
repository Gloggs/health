import { cn } from "@/lib/utils";

/**
 * Page title block: the page's name in Barlow Condensed capitals, an
 * optional plain description under it, and an optional control on the
 * right. Titles are names, not slogans (docs/DESIGN.md, Writing).
 *
 *   <PageHero title="Train" right={<RangePicker />} />
 */
export default function PageHero({ title, subtitle, right, className, children }) {
  return (
    <div className={cn("flex flex-col gap-3 pb-2", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-base text-muted-foreground">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}
