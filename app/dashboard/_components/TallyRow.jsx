"use client";

// Visualised tally row — proper 5-bar grouping. Every group of five is four
// vertical strokes plus one diagonal crossing them; any leftover renders as
// lone verticals. So "6 of 7" reads as one crossed group of five and a
// single stroke. Renders nothing at count 0.
//
// Each group is a single self-contained SVG (verticals + diagonal sized to
// the group), which is robust — the previous version positioned the diagonal
// with a negative margin and it didn't line up across the strokes.
export default function TallyRow({ count = 0, total = 7, label = "etched today" }) {
  if (count <= 0) return null;
  const clamped = Math.min(count, 14);

  const groups = [];
  let remaining = clamped;
  while (remaining >= 5) {
    groups.push({ filled: 4, crossed: true });
    remaining -= 5;
  }
  if (remaining > 0) groups.push({ filled: remaining, crossed: false });

  const tilts = ["-1.5deg", "1deg", "-0.5deg"];

  return (
    <div className="rounded-2xl border border-dashed bg-card/30 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          ── {label} ──
        </span>
        <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
          {count} / {total}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {groups.map((g, i) => (
          <TallyGroup key={i} filled={g.filled} crossed={g.crossed} tilt={tilts[i % tilts.length]} />
        ))}
      </div>
    </div>
  );
}

// One tally group: `filled` vertical strokes (1–4) and, when `crossed`, a
// diagonal slash across the whole group to close a set of five.
function TallyGroup({ filled = 4, crossed = false, tilt = "0deg" }) {
  const xs = [];
  for (let i = 0; i < filled; i++) xs.push(8 + i * 12);
  const lastX = xs.length ? xs[xs.length - 1] : 8;
  const w = lastX + 8;
  return (
    <svg
      width={w}
      height="36"
      viewBox={`0 0 ${w} 36`}
      fill="none"
      aria-hidden
      style={{ transform: `rotate(${tilt})` }}
    >
      {xs.map((x, i) => (
        <line
          key={i}
          x1={x}
          y1="4"
          x2={x}
          y2="32"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
      {crossed && (
        <line
          x1="3"
          y1="33"
          x2={w - 3}
          y2="3"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
