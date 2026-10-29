import { CalendarCheck, ChartLine, Dumbbell, NotebookPen, Users } from "lucide-react";

/**
 * The five places in the app, the same on phones (bottom tabs) and desktop
 * (sidebar). `base` is "/dashboard" for the real app and "/demo" for the
 * demo, so both use one list and can never drift apart.
 *
 * `also` lists other paths that belong to a tab, so the right tab stays lit
 * on sub-pages (a plan belongs to Train, family chat belongs to Family).
 */
export const NAV = [
  { key: "today", label: "Today", path: "", icon: CalendarCheck, also: [] },
  { key: "log", label: "Log", path: "/log", icon: NotebookPen, also: ["/journal"] },
  { key: "train", label: "Train", path: "/train", icon: Dumbbell, also: ["/plans", "/exercises"] },
  { key: "trends", label: "Trends", path: "/trends", icon: ChartLine, also: ["/me/trends"] },
  { key: "family", label: "Family", path: "/family", icon: Users, also: ["/chat"] },
];

export function navItems(base) {
  return NAV.map((n) => ({ ...n, href: base + n.path, also: n.also.map((a) => base + a) }));
}

/** Which tab owns this path. Longest match wins; Today only owns the base itself. */
export function activeKey(pathname, base) {
  if (!pathname) return null;
  let best = null;
  let bestLen = -1;
  for (const n of navItems(base)) {
    const owns =
      n.path === ""
        ? pathname === base
        : [n.href, ...n.also].some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!owns) continue;
    const len = n.href.length;
    if (len > bestLen) {
      best = n.key;
      bestLen = len;
    }
  }
  return best;
}
