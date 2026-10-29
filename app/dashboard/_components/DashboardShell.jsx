"use client";

import { Suspense } from "react";
import { useKindeBrowserClient, LogoutLink } from "@kinde-oss/kinde-auth-nextjs";
import { LogOut } from "lucide-react";
import AppShell from "@/components/shell/AppShell";
import ViewingBanner from "./ViewingBanner";
import { initialsOf } from "@/lib/initials";


// The signed-in app frame: the shared AppShell with the Kinde user, a sign
// out link, and the "viewing someone else's day" strip.
export default function DashboardShell({ children }) {
  const { user } = useKindeBrowserClient();
  const name = [user?.given_name, user?.family_name].filter(Boolean).join(" ") || user?.email || "You";

  return (
    <AppShell
      base="/dashboard"
      user={{ name, initials: initialsOf(name) }}
      signOut={
        <LogoutLink className="flex h-12 items-center gap-3 px-6 text-sm text-chalk/80">
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </LogoutLink>
      }
      top={
        <Suspense fallback={null}>
          <ViewingBanner />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
