import { cn } from "@/lib/utils";

/**
 * Shared empty-state surface. Replaces the ~12 ad-hoc "No entries yet."
 * paragraphs scattered across the app with a single voiced, on-brand
 * pattern: dashed paper border, optional icon, Caveat handwritten title,
 * small body, optional CTA slot.
 *
 * Defaults:
 *   - dashed border in --rule (paper-coloured)
 *   - title in Caveat handwritten (text-2xl)
 *   - body in muted body sans
 *
 * Use:
 *   <EmptyState
 *     icon={Bed}
 *     title="nothing logged yet"
 *     body="Tap the sleep tile on Today to start the streak."
 *   />
 *
 *   <EmptyState
 *     title="quiet for now"
 *     compact   // smaller, fits inside a tile/card
 *   />
 *
 *   <EmptyState
 *     title="no messages yet"
 *     body="Say something to the family room — it'll show up here."
 *     action={<Button asChild><Link href="/dashboard/chat">Open chat</Link></Button>}
 *   />
 */
export default function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact = false,
  className = "",
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 bg-card/30 text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className
      )}
    >
      {Icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      ) : null}
      {title ? (
        <p className="font-handwritten text-2xl leading-none text-muted-foreground">
          {title}
        </p>
      ) : null}
      {body ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
