"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useKindeBrowserClient, LogoutLink } from "@kinde-oss/kinde-auth-nextjs";
import {
  Flame,
  Dumbbell,
  NotebookPen,
  MessageCircle,
  User,
  Users,
  LogOut,
  Settings,
  ChevronLeft,
  ChevronRight,
  LineChart as ChartIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import HealthMark from "@/components/HealthMark";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV = [
  { label: "Today", href: "/dashboard", icon: Flame, aliases: [] },
  { label: "Train", href: "/dashboard/train", icon: Dumbbell, aliases: ["/dashboard/plans", "/dashboard/exercises"] },
  { label: "Log", href: "/dashboard/log", icon: NotebookPen, aliases: [] },
  { label: "Trends", href: "/dashboard/trends", icon: ChartIcon, aliases: ["/dashboard/me/trends"] },
  { label: "Family", href: "/dashboard/family", icon: Users, aliases: [] },
  { label: "Chat", href: "/dashboard/chat", icon: MessageCircle, aliases: [] },
  { label: "Me", href: "/dashboard/me", icon: User, aliases: ["/dashboard/settings"] },
];

// Pick the single best-matching nav item for the current pathname. Earlier
// implementation matched any item whose href is a prefix of the URL, so on
// /dashboard/me/trends *both* "Me" (via prefix /dashboard/me) AND "Trends"
// (via alias /dashboard/me/trends) lit up at once. Aliases now win because
// they're explicit overrides; among the remaining items, the longest prefix
// match wins (so /dashboard/plans/123 prefers "Train" over "Today").
function resolveActiveHref(pathname, nav) {
  if (pathname === "/dashboard") return "/dashboard";
  // Alias hit beats everything — these are owned sub-paths.
  for (const { href, aliases } of nav) {
    for (const a of aliases) {
      if (pathname === a || pathname.startsWith(a + "/")) return href;
    }
  }
  // Otherwise the deepest matching href wins. Today (`/dashboard`) is
  // excluded from this pass so it never claims sub-routes.
  let best = null;
  let bestLen = -1;
  for (const { href } of nav) {
    if (href === "/dashboard") continue;
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (href.length > bestLen) {
        best = href;
        bestLen = href.length;
      }
    }
  }
  return best;
}

const STORAGE_KEY = "sidebar.collapsed";

export default function Sidebar() {
  const { user } = useKindeBrowserClient();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setCollapsed(saved === "true");
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <TooltipProvider delayDuration={120}>
      <aside
        className={cn(
          "relative flex h-screen flex-col border-r bg-card transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 border-b px-4 py-4 transition-colors hover:bg-accent/40"
          aria-label="Health, back to Today"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            <HealthMark size={36} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-serif text-base font-bold leading-tight tracking-tight">
                Health
              </p>
            </div>
          )}
        </Link>

        <nav className="flex-1 space-y-0.5 p-3" aria-label="Primary">
          {(() => {
            const activeHref = resolveActiveHref(pathname, NAV);
            return NAV.map(({ label, href, icon: Icon }) => {
              const active = href === activeHref;
            // Active-rail pattern: a 3-px ox-blood bar pinned to the left
            // gives an editorial "this is your spot" feel that pure
            // background-fill can't match. Inactive items still get the
            // soft hover; active ones get the rail + a faint tint.
            const item = (
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary",
                      collapsed && "h-7"
                    )}
                  />
                )}
                <Icon
                  className={cn(
                    "h-4.5 w-4.5 shrink-0 transition-colors",
                    active ? "text-primary" : "",
                    collapsed && "mx-auto"
                  )}
                  size={18}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{item}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={href}>{item}</div>
            );
            });
          })()}
          {/* IIFE above resolves a single active item and walks NAV once. */}
        </nav>

        {mounted && (
          <div className="space-y-1.5 border-t p-3">
            {/* Settings shortcut sits above the avatar row so the user can
                always jump straight to preferences without going via Me →
                Settings. Behaves the same as a nav item but isn't part of
                the main rail because it isn't a primary surface. */}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/dashboard/settings"
                    aria-label="Settings"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span>Settings</span>
              </Link>
            )}

            <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
              {user?.picture ? (
                <Image src={user.picture} alt="user" width={36} height={36} className="rounded-full border" />
              ) : (
                <Image src="/health-mark.svg" alt="Health" width={36} height={36} className="rounded-full border bg-card p-1" />
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {user?.given_name} {user?.family_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              )}
              {/* Logout stays visible in BOTH collapsed and expanded modes —
                  the previous behaviour hid it when collapsed, which left
                  power users hunting for a way out. */}
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <LogoutLink
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      postLogoutRedirectURL="/signed-out"
                      aria-label="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </LogoutLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              ) : (
                <LogoutLink
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  postLogoutRedirectURL="/signed-out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </LogoutLink>
              )}
            </div>
          </div>
        )}

        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}
