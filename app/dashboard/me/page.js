"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutLink, useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { todayDateStr } from "@/lib/dates";
import { VISIBILITY_SECTIONS, effectiveVisibility } from "@/lib/visibility";
import { initialsOf } from "@/lib/initials";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHero from "../_components/PageHero";
import GoalsCard from "../_components/GoalsCard";

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

const rowClass = "flex min-h-[56px] w-full items-center gap-3 border-b border-border px-4 text-left text-base last:border-b-0";

function Row({ href, label, detail }) {
  return (
    <Link href={href} className={rowClass}>
      <span className="flex-1 font-semibold">{label}</span>
      {detail ? <span className="truncate text-sm text-muted-foreground">{detail}</span> : null}
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
    </Link>
  );
}

/**
 * You: who you are, what your family can see, and your account. A plain list,
 * the same on phones and desktop. Shared by the real app and the demo.
 */
export default function YouPage() {
  const pathname = usePathname();
  const isDemo = pathname?.startsWith("/demo");
  const base = isDemo ? "/demo" : "/dashboard";
  const { user } = useKindeBrowserClient();
  const [me, setMe] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    GlobalApi.GetMe()
      .then((r) => setMe(r.data ?? null))
      .catch(() => setMe(null));
  }, []);

  const name =
    me?.displayName ||
    [user?.given_name, user?.family_name].filter(Boolean).join(" ") ||
    "You";
  const initials = initialsOf(name);
  const email = me?.email ?? user?.email ?? "";

  const vis = effectiveVisibility(me?.visibility);
  const shared = VISIBILITY_SECTIONS.filter((s) => vis[s.key]).length;
  const sharedText =
    shared === VISIBILITY_SECTIONS.length ? "Everything" : shared === 0 ? "Nothing" : `${shared} of ${VISIBILITY_SECTIONS.length}`;

  const exportAll = async () => {
    setExporting(true);
    try {
      const r = await GlobalApi.ExportAll();
      downloadJson(`health-export-${todayDateStr()}.json`, r.data);
      toast("Your data is downloading");
    } catch {
      toast.error("Export did not work. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 md:p-6">
      <PageHero title="You" />

      <section aria-label="Profile" className="flex items-center gap-4 border border-foreground bg-card p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-brand-sky font-display text-2xl font-extrabold text-ink">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl font-bold uppercase leading-tight">{name}</p>
          {email ? <p className="truncate text-sm text-muted-foreground">{email}</p> : null}
        </div>
        <Link href={`${base}/settings?tab=profile`} className="h-11 shrink-0 border border-foreground px-4 text-sm font-semibold leading-[42px]">
          Edit
        </Link>
      </section>

      <section aria-labelledby="you-family" className="flex flex-col gap-2">
        <h2 id="you-family" className="font-display text-xl font-bold uppercase">What your family sees</h2>
        <div className="border border-foreground bg-card">
          <Row href={`${base}/settings?tab=privacy`} label="Shared with family" detail={sharedText} />
          <Row href={`${base}/family`} label="Invite someone" />
        </div>
      </section>

      <GoalsCard />

      <section aria-labelledby="you-settings" className="flex flex-col gap-2">
        <h2 id="you-settings" className="font-display text-xl font-bold uppercase">Settings</h2>
        <div className="border border-foreground bg-card">
          <Row href={`${base}/settings?tab=coach`} label="Goals and targets" detail="Water target, notes" />
          <Row href={`${base}/settings?tab=profile`} label="Profile" detail="Name, birthday, height" />
          <Row href={`${base}/settings?tab=appearance`} label="Display" detail="Light, dark, units" />
        </div>
      </section>

      <section aria-labelledby="you-account" className="flex flex-col gap-2">
        <h2 id="you-account" className="font-display text-xl font-bold uppercase">Account</h2>
        <div className="border border-foreground bg-card">
          <button type="button" onClick={exportAll} disabled={exporting} className={`${rowClass} disabled:opacity-50`}>
            <span className="flex-1 font-semibold">{exporting ? "Exporting" : "Export my data"}</span>
            <span className="text-sm text-muted-foreground">JSON file</span>
          </button>
          <Row href="/privacy" label="Privacy" />
          <Row href="/terms" label="Terms" />
          {isDemo ? (
            <Link href="/" className={rowClass}>
              <span className="flex-1 font-semibold">Leave the demo</span>
            </Link>
          ) : (
            <LogoutLink postLogoutRedirectURL="/signed-out" className={rowClass}>
              <span className="flex-1 font-semibold">Sign out</span>
            </LogoutLink>
          )}
        </div>
      </section>
    </div>
  );
}
