"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import HealthMark from "@/components/HealthMark";
import NotificationsBell from "@/app/dashboard/_components/NotificationsBell";
import SearchPalette from "./SearchPalette";
import { activeKey, navItems } from "./nav";
import { cn } from "@/lib/utils";

/**
 * The app frame for the real app and the demo alike:
 * - phones: navy top bar (logo, search, notifications, you) and five tabs at the bottom
 * - desktop: navy sidebar with the same five places, and a search bar on top
 *
 *   base     "/dashboard" or "/demo"
 *   user     { name, detail, initials }
 *   signOut  sign-out control for the sidebar, or null in the demo
 *   banner   strip above everything (the demo's "sample data" bar)
 *   top      strip above the page content (viewing a relative's day)
 */
export default function AppShell({ base, user, signOut, banner, top, children }) {
  const pathname = usePathname();
  const items = navItems(base);
  const current = activeKey(pathname, base);
  const youHref = `${base}/me`;
  const onYou = pathname === youHref || pathname?.startsWith(`${base}/settings`);
  const [searchOpen, setSearchOpen] = useState(false);

  // "/" or Ctrl/Cmd + K opens search, unless you are typing somewhere.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {banner}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[232px] shrink-0 flex-col bg-ink text-chalk md:flex">
          <Link href={base} className="flex items-center gap-2.5 px-6 pb-6 pt-5 font-display text-[28px] font-extrabold uppercase leading-none">
            <HealthMark size={26} title="" aria-hidden />
            Health
          </Link>
          <nav aria-label="Main" className="flex flex-col">
            {items.map(({ key, label, href, icon: Icon }) => (
              <Link
                key={key}
                href={href}
                aria-current={current === key ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-3 px-6 text-base",
                  current === key ? "bg-chalk font-bold text-ink" : "text-chalk"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-white/20">
            <Link
              href={youHref}
              aria-current={onYou ? "page" : undefined}
              className={cn("flex h-16 items-center gap-3 px-6", onYou ? "bg-chalk text-ink" : "text-chalk")}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand-sky text-sm font-bold text-ink">
                {user?.initials ?? "?"}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] font-semibold">{user?.name ?? "You"}</span>
                <span className={cn("truncate text-xs", onYou ? "text-ink/70" : "text-chalk/70")}>You and settings</span>
              </span>
            </Link>
            {signOut}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phone top bar */}
          <header className="flex h-14 shrink-0 items-center justify-between bg-ink pl-4 pr-1 text-chalk md:hidden">
            <Link href={base} className="flex items-center gap-2 font-display text-[26px] font-extrabold uppercase leading-none">
              <HealthMark size={22} title="" aria-hidden />
              Health
            </Link>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="flex h-11 w-11 items-center justify-center"
              >
                <Search className="h-5 w-5" aria-hidden />
              </button>
              <NotificationsBell className="text-chalk" />
              <Link
                href={youHref}
                aria-label="You and settings"
                className="ml-1 flex h-11 w-11 items-center justify-center bg-brand-sky text-sm font-bold text-ink"
              >
                {user?.initials ?? "?"}
              </Link>
            </div>
          </header>

          {/* Desktop top bar */}
          <header className="hidden h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-8 md:flex">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-11 w-full max-w-[440px] items-center gap-3 border border-foreground bg-card px-3 text-left text-base text-muted-foreground"
            >
              <Search className="h-5 w-5 text-foreground" aria-hidden />
              <span className="flex-1">Search logs, exercises, plans, settings</span>
              <kbd className="border border-border px-1.5 text-xs">/</kbd>
            </button>
            <NotificationsBell />
          </header>

          {top}

          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain outline-none">
            {children}
          </main>

          {/* Phone tabs */}
          <nav
            aria-label="Main"
            className="grid shrink-0 grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            {items.map(({ key, label, href, icon: Icon }) => (
              <Link
                key={key}
                href={href}
                aria-current={current === key ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[13px]",
                  current === key ? "bg-foreground font-bold text-background" : "text-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} base={base} />
    </div>
  );
}
