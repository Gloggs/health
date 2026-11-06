import { CalendarCheck, FileText, Menu, NotebookPen, PenLine } from "lucide-react";

/**
 * The five places in the app, the same on phones (bottom tabs) and desktop
 * (sidebar). `base` is "/dashboard" for the real app and "/demo" for the
 * demo, so both use one list and can never drift apart.
 *
 * health v2 (6 November 2026): the places follow the job (getting ready for the GP). Train, Trends,
 * Family and Settings are one tap away under More (progressive disclosure), not removed.
 * `also` lists other paths that belong to a tab, so the right tab stays lit on sub-pages.
 */
export const NAV = [
  { key: "today", label: "Today", path: "", icon: CalendarCheck, also: [] },
  { key: "feel", label: "How I feel", path: "/feel", icon: PenLine, also: [] },
  { key: "summary", label: "For my GP", path: "/summary", icon: FileText, also: [] },
  { key: "log", label: "Log", path: "/log", icon: NotebookPen, also: ["/journal"] },
  { key: "more", label: "More", path: "/more", icon: Menu, also: ["/train", "/plans", "/exercises", "/trends", "/me", "/family", "/chat", "/settings"] },
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
