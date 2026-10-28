/**
 * The Etch brand mark — 4 vertical ink strokes + 1 ox-blood diagonal
 * slash. The tally mark IS the logo (per BRAND.md §2); the monospace
 * "E" tile we used before is now reserved for the favicon's rounded
 * background and as the user-avatar fallback.
 *
 * Inline SVG (not an <img>) so it inherits currentColor for the strokes
 * when needed and avoids the network round-trip + decoding cost on
 * every page load. Single source of truth — when the artwork is
 * refreshed by a designer, edit here, not in 8 individual pages.
 *
 * Use:
 *   <EtchMark size={40} />
 *   <EtchMark size={36} variant="paper" />   // rounded paper card behind
 *
 * variants:
 *   - "transparent" (default) — strokes on whatever background
 *   - "paper"                  — strokes on a rounded paper-coloured tile
 *                                (use when the surrounding bg isn't paper)
 *   - "ink"                    — strokes on rounded ink-coloured tile
 *                                (use when surface is paper and we want
 *                                 the mark to read as a stamped logo)
 */
export default function EtchMark({
  size = 40,
  variant = "transparent",
  className = "",
  ...props
}) {
  const showPaper = variant === "paper";
  const showInk = variant === "ink";

  const tileFill = showPaper
    ? "#F8F5EF"
    : showInk
    ? "#1A1410"
    : "transparent";
  const inkStroke = showInk ? "#F0EAD8" : "#1A1410";
  const accentStroke = showInk ? "#D8483A" : "#A4271E";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Etch"
      className={className}
      {...props}
    >
      {showPaper || showInk ? (
        <rect width="512" height="512" rx="96" ry="96" fill={tileFill} />
      ) : null}
      <g stroke={inkStroke} strokeWidth={showPaper || showInk ? 32 : 36} strokeLinecap="round">
        <line x1="128" y1="128" x2="128" y2="384" />
        <line x1="200" y1="128" x2="200" y2="384" />
        <line x1="272" y1="128" x2="272" y2="384" />
        <line x1="344" y1="128" x2="344" y2="384" />
      </g>
      <line
        x1="96"
        y1="384"
        x2="376"
        y2="128"
        stroke={accentStroke}
        strokeWidth={showPaper || showInk ? 40 : 44}
        strokeLinecap="round"
      />
    </svg>
  );
}
