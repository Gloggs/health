"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Flame,
  Dumbbell,
  NotebookPen,
  LineChart,
  Users,
  MessageCircle,
  User,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import HealthMark from "@/components/HealthMark";
import { resetStore } from "../_mock/store";

// Demo-only app frame. Mirrors the real dashboard layout's look (sidebar +
// top bar + bottom nav) but its nav points at /demo/* and it shows a fake
// demo user, so we never touch the Kinde-coupled real Sidebar.
const NAV_FAMILY = [
  { label: "Today", href: "/demo", icon: Flame },
  { label: "Train", href: "/demo/train", icon: Dumbbell },
  { label: "Log", href: "/demo/log", icon: NotebookPen },
  { label: "Trends", href: "/demo/trends", icon: LineChart },
  { label: "Family", href: "/demo/family", icon: Users },
  { label: "Chat", href: "/demo/chat", icon: MessageCircle },
  { label: "Me", href: "/demo/me", icon: User },
];
// Solo mode: the social surfaces stay out of the story.
const NAV_SOLO = NAV_FAMILY.filter((n) => !["Family", "Chat"].includes(n.label));

function isActive(pathname, href) {
  return href === "/demo" ? pathname === "/demo" : pathname.startsWith(href);
}

export default function DemoShell({ children }) {
  const pathname = usePathname();
  const [now, setNow] = useState("");
  const [mode, setModeState] = useState("family");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    setNow(fmt());
    const t = setInterval(() => setNow(fmt()), 30_000);
    return () => clearInterval(t);
  }, []);

  // MockProvider (a child) resolves ?mode= into sessionStorage before this
  // parent effect runs, so reading it here is ordered correctly.
  useEffect(() => {
    try {
      setModeState(window.sessionStorage.getItem("etch-demo-mode") === "solo" ? "solo" : "family");
    } catch {
      /* default family */
    }
  }, [pathname]);

  function switchMode(next) {
    if (next === mode) return;
    try {
      window.sessionStorage.setItem("etch-demo-mode", next);
    } catch {
      /* no-op */
    }
    // Full reload re-seeds the store for the new household shape.
    window.location.href = "/demo?mode=" + next;
  }

  function reset() {
    resetStore();
    window.location.reload();
  }

  const NAV = mode === "solo" ? NAV_SOLO : NAV_FAMILY;
  // Mobile keeps the real app's five tabs: Today / Train / Log / Family / Me
  // (solo swaps Family for Trends). Chat stays reachable from the sidebar
  // on desktop and via in-page links on mobile.
  const bottomLabels =
    mode === "solo"
      ? ["Today", "Train", "Log", "Trends", "Me"]
      : ["Today", "Train", "Log", "Family", "Me"];
  const bottomNav = bottomLabels
    .map((l) => NAV_FAMILY.find((n) => n.label === l))
    .filter(Boolean);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      {/* Demo banner */}
      <div className="flex items-center justify-between gap-2 border-b bg-primary/10 px-3 py-1.5 sm:px-4">
        <p className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
          <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="truncate">
            Demo<span className="hidden sm:inline">, nothing is saved</span>
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {/* Solo / Family switch */}
          <div
            role="group"
            aria-label="Demo mode"
            className="flex overflow-hidden rounded-md border bg-background/60 text-[11px] font-medium"
          >
            {["solo", "family"].map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "px-2 py-1 capitalize transition-colors",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={reset}
            aria-label="Reset demo data"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <Button asChild size="sm" className="h-7">
            <Link href="/request-invite">Get access</Link>
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar (md+) */}
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
          <Link href="/demo" className="flex items-center gap-2.5 border-b px-4 py-4">
            <HealthMark size={32} />
            <span className="leading-none">
              <span className="block font-serif text-base font-bold">Health</span>
            </span>
          </Link>
          <nav className="flex-1 space-y-0.5 p-3">
            {NAV.map(({ label, href, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5 shrink-0", active && "text-primary")} size={18} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 border-t p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border bg-background">
              <HealthMark size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">You</p>
              <p className="truncate text-xs text-muted-foreground">demo account</p>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <p className="font-handwritten text-sm text-muted-foreground">{now}</p>
            <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Demo
            </span>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-24 md:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="flex border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {bottomNav.map(({ label, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
