import { cn } from "@/lib/utils";

/**
 * The Caveat handwritten label pattern. Documented in BRAND.md §Caveat
 * scale; this component enforces the rules:
 *   - Always lowercase
 *   - Four sizes (hero/eyebrow/inline/hint) matching the documented scale
 *   - text-primary/80 by default (the "ink-on-paper margin scribble" tone)
 *
 *   <HandwrittenLabel>family</HandwrittenLabel>
 *   <HandwrittenLabel size="hero">tuesday</HandwrittenLabel>
 *   <HandwrittenLabel size="hint" tone="muted">track less. notice more.</HandwrittenLabel>
 */
const SIZES = {
  hero: "text-2xl",       // sm: hero label / day-of-week
  eyebrow: "text-xl",     // PageHero eyebrow
  inline: "text-base",    // unit suffix, tile label, rail label
  hint: "text-sm",        // tagline, empty-state body
};
const TONES = {
  primary: "text-primary/80",
  foreground: "text-foreground/70",
  muted: "text-muted-foreground",
};

export default function HandwrittenLabel({
  size = "inline",
  tone = "primary",
  className,
  children,
  ...props
}) {
  return (
    <span
      className={cn(
        "font-handwritten leading-none",
        SIZES[size] ?? SIZES.inline,
        TONES[tone] ?? TONES.primary,
        className
      )}
      {...props}
    >
      {/* Enforce lowercase regardless of caller, matching BRAND.md rule */}
      {typeof children === "string" ? children.toLowerCase() : children}
    </span>
  );
}
