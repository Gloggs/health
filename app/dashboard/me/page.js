"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LogoutLink, useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import Image from "next/image";
import {
  Bell,
  Settings as SettingsIcon,
  Download,
  TrendingUp,
  ArrowRight,
  MessageCircle,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { daysAgoStr, todayDateStr, weekStartStr } from "@/lib/dates";
import { computeWeeklyDiscipline } from "@/lib/discipline";
import GlobalApi from "@/app/_services/GlobalApi";
import GoalsCard from "../_components/GoalsCard";
import PageHero from "../_components/PageHero";

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function MeHubPage() {
  const today = todayDateStr();
  const weekStart = weekStartStr();
  const { user } = useKindeBrowserClient();
  const [loading, setLoading] = useState(true);
  const [discipline, setDiscipline] = useState(null);
  const [userCtx, setUserCtx] = useState(null);
  // Pulls the editable in-app profile (displayName, age, height) so we can
  // show the user's Health name rather than the Kinde-derived first/last
  // pair. Without this the Family page would say "Mike" while Me said
  // "Michael Ijisonu" — same person, different names.
  const [me, setMe] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      GlobalApi.GetCheckIn({ from: weekStart, to: today }),
      GlobalApi.GetSessions({ from: weekStart, to: today }),
      GlobalApi.GetUserContext().catch(() => ({ data: null })),
      GlobalApi.GetMe().catch(() => ({ data: null })),
    ])
      .then(([c, s, ctx, meRes]) => {
        const sessionDates = new Set((s.data ?? []).filter((x) => x.completed).map((x) => x.date));
        setDiscipline(computeWeeklyDiscipline(c.data ?? [], sessionDates));
        setUserCtx(ctx?.data ?? null);
        setMe(meRes?.data ?? null);
      })
      .finally(() => setLoading(false));
  }, [today, weekStart]);

  const isCoachEmpty =
    !loading &&
    !(userCtx?.goals || userCtx?.restrictions || userCtx?.preferences);

  const exportAll = async () => {
    setExporting(true);
    try {
      const r = await GlobalApi.ExportAll();
      downloadJson(`health-export-${today}.json`, r.data);
      toast.success("Exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        eyebrow="me"
        title="You"
        subtitle="Discipline, insights, reminders, and your data, all on your row only."
      />

      {/* Profile + sign out. The sidebar carries this on desktop, but the mobile
          bottom-nav doesn't - so the only sign-out path on mobile lives here. */}
      <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-paper-1 paper-texture">
        {user?.picture ? (
          <Image src={user.picture} width={44} height={44} alt="Profile" className="rounded-full border" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserIcon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {/* Prefer the in-app display name (Settings → Profile) so this
              page matches what the Family roster shows. Falls back to the
              Kinde-derived first/last while the GetMe call is in flight,
              and to "Signed in" if neither has loaded. */}
          <p className="truncate text-sm font-semibold">
            {me?.displayName
              || (user?.given_name || user?.family_name
                ? `${user?.given_name ?? ""} ${user?.family_name ?? ""}`.trim()
                : "Signed in")}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/dashboard/settings?tab=profile"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Link>
          <LogoutLink
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            postLogoutRedirectURL="/signed-out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </LogoutLink>
        </div>
      </div>

      {/* Goals nudge - surfaces until the user fills any field. The
          tab slug stays `coach` for URL back-compat (old bookmarks);
          the UI calls it Goals. */}
      {isCoachEmpty ? (
        <Link
          href="/dashboard/settings?tab=coach"
          className="hover-paper block rounded-2xl bg-primary/5 p-5 shadow-paper-1 paper-texture"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base font-semibold">Set your goals</p>
              <p className="mt-1 text-xs text-muted-foreground">
                What you're working on, what to avoid, what you prefer. Private
                to you, useful shorthand for when you come back after a few
                weeks. 30 seconds.
              </p>
            </div>
            <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-primary" />
          </div>
        </Link>
      ) : null}

      {/* This week's discipline */}
      <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">This week</p>
            <p className="mt-1 text-sm font-medium">Follow-through score</p>
          </div>
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>

        {loading ? (
          <Skeleton className="mt-3 h-12 w-32" />
        ) : discipline?.score10 == null ? (
          <div className="mt-3">
            <p className="text-3xl font-bold tabular-nums">-</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tap the daily check-in on Today to start scoring this metric.
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-4xl font-bold tabular-nums">
              {discipline.score10.toFixed(1)}
              <span className="text-base font-medium text-muted-foreground">/10</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {discipline.scoredDays} day{discipline.scoredDays === 1 ? "" : "s"} of resistance check-ins this week.
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round((discipline.score01 ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <GoalsCard />

      {/* Hub tiles - things not reachable from the 5-slot mobile bottom nav.
          Family used to live here but got promoted into the bottom nav in
          P3 polish; Chat takes its slot so the journal + family room
          are one tap away from this hub. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Trends is also reachable from the desktop sidebar, but on
            mobile the only path is via this hub. Promoted to first slot
            here so it doesn't get buried, discovered in the J.1 a11y
            audit (no path on mobile bottom nav). */}
        <HubTile href="/dashboard/me/trends" icon={TrendingUp} label="Trends" desc="Weekly + monthly charts, no AI" />
        <HubTile href="/dashboard/chat" icon={MessageCircle} label="Chat" desc="Family room + private journal" />
        <HubTile href="/dashboard/me/reminders" icon={Bell} label="Reminders" desc="Water, meals, weigh-ins, supplements" />
        <HubTile href="/dashboard/settings" icon={SettingsIcon} label="Settings" desc="Profile, appearance, account" />
        <button
          onClick={exportAll}
          disabled={exporting}
          className="hover-lift group flex items-center gap-4 rounded-2xl bg-card p-4 shadow-paper-1 paper-texture text-left disabled:opacity-50"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{exporting ? "Exporting…" : "Export everything"}</p>
            <p className="truncate text-xs text-muted-foreground">JSON of all your data</p>
          </div>
        </button>
      </div>
    </div>
  );
}

function HubTile({ href, icon: Icon, label, desc }) {
  return (
    <Link
      href={href}
      className="hover-lift group flex items-center gap-4 rounded-2xl bg-card p-4 shadow-paper-1 paper-texture"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
