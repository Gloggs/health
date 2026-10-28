import { cn } from "@/lib/utils";

/**
 * The "this is etched, count it" number pattern. Used 12+ times across
 * Today, Family, Trends, Me with subtly-different styling — extracted to
 * collapse the variation.
 *
 * Three sizes:
 *   - "xl"  — big page hero numbers (Today's etched-today count, etc).
 *             ~28-32px mono.
 *   - "md"  — section-level numbers (stat cards, follow-through score).
 *             ~20px mono.
 *   - "sm"  — inline numbers (X of 7, last seen). ~14-16px mono.
 *
 * Optional `unit` renders in Caveat handwritten alongside the number
 * (per Caveat scale: text-base for inline units). Following the "data
 * in mono, unit in handwriting" pattern that lifted Today's streak
 * treatment from "stat" to "moment".
 *
 *   <StatNumber value={3} size="xl" unit="of 7" />
 *   <StatNumber value="7.2" size="md" unit="/10" />
 *   <StatNumber value={158.4} size="sm" unit="kg" />
 */
const SIZE_NUMBER = {
  xl: "text-2xl sm:text-3xl",
  md: "text-xl",
  sm: "text-base",
};
const SIZE_UNIT = {
  xl: "text-xl",
  md: "text-base",
  sm: "text-sm",
};

export default function StatNumber({
  value,
  unit,
  size = "md",
  unitTone = "muted",
  className,
}) {
  const numberCls = SIZE_NUMBER[size] ?? SIZE_NUMBER.md;
  const unitCls = SIZE_UNIT[size] ?? SIZE_UNIT.md;
  const unitColor =
    unitTone === "primary"
      ? "text-primary/80"
      : unitTone === "foreground"
      ? "text-foreground/80"
      : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "font-mono font-bold leading-none tabular-nums tracking-tight",
          numberCls
        )}
      >
        {value}
      </span>
      {unit ? (
        <span
          className={cn(
            "font-handwritten leading-none",
            unitCls,
            unitColor
          )}
        >
          {unit}
        </span>
      ) : null}
    </span>
  );
}
