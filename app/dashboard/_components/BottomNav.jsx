"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Dumbbell,
  NotebookPen,
  Users,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mobile bottom nav - five slots only. Family was promoted into this row
// in P3 polish (replacing Chat) because it's the soul of the app post-
// Phase-2 and burying it inside Me hub was costing usage. Chat is now
// reachable from the Me hub as a tile. Trends still lives on the desktop
// sidebar only - the iPhone-width constraint hasn't changed.
const TABS = [
  { label: "Today", href: "/dashboard", icon: Flame, aliases: [] },
  { label: "Train", href: "/dashboard/train", icon: Dumbbell, aliases: ["/dashboard/plans", "/dashboard/exercises"] },
  { label: "Log", href: "/dashboard/log", icon: NotebookPen, aliases: [] },
  { label: "Family", href: "/dashboard/family", icon: Users, aliases: [] },
  { label: "Me", href: "/dashboard/me", icon: User, aliases: ["/dashboard/settings", "/dashboard/trends", "/dashboard/me/trends", "/dashboard/chat"] },
];

function isActive(pathname, href, aliases) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (pathname === href || pathname.startsWith(href + "/")) return true;
  return aliases.some((a) => pathname === a || pathname.startsWith(a + "/"));
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card backdrop-blur md:hidden">
      <div className="pb-safe grid grid-cols-5">
        {TABS.map(({ label, href, icon: Icon, aliases }) => {
          const active = isActive(pathname, href, aliases);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                // On very narrow screens, suppress the text label so the icon
                // gets the full tap target - six labels in 360px is too tight.
                "flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors xs:gap-1 xs:py-2.5 xs:text-[11px]",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-11 items-center justify-center rounded-lg transition-colors xs:w-12",
                  active ? "bg-primary/10" : ""
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  "hidden font-medium xs:inline",
                  active && "text-primary"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
