import Link from "next/link";
import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { LogOut } from "lucide-react";
import HealthMark from "@/components/HealthMark";

// Dead-end page for users whose email isn't on the FAMILY_EMAILS allow-list
// AND who don't yet have a MEMBERSHIPS row. They've authenticated with Kinde
// but no family has invited them, so middleware lands them here instead of
// /dashboard.
//
// Post Phase D the more useful action is "ask for an invite" — the
// FAMILY_EMAILS env var is being decommissioned, so anyone reaching this
// page should be invited via /join/<token> rather than added to env vars.
// Sign-out is the secondary action for "wrong Google account" recovery.
export const metadata = {
  title: "Not in a family",
};

export default function NotAuthorizedPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-paper-1 sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <HealthMark size={48} />
        </div>
        <p className="mt-3 font-display uppercase text-sm font-semibold text-muted-foreground">
          Health
        </p>
        <h1 className="mt-4 font-display uppercase text-2xl font-bold ">
          You're not in a family yet.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Health is invite-based. Ask whoever set up your family to send you
          a join link, once you click it, you're in.
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Signed in with the wrong inbox? Sign out and try again.
        </p>
        <div className="mt-6 flex flex-col items-stretch gap-2">
          <LogoutLink
            postLogoutRedirectURL="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold transition-colors hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </LogoutLink>
          <Link
            href="/"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
