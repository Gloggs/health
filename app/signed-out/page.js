"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HealthMark from "@/components/HealthMark";

// Etch-branded sign-out confirmation page. Reached after Kinde logout.
// Visual language matches the rest of the app: paper background, ink
// wordmark, ox-blood CTA. Copy keeps the calm voice — no exclamation,
// no marketing fluff.
export default function SignedOutPage() {
  // Set by Settings > Your data just before signing out after "Delete everything".
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("health-deleted") === "1") {
        setDeleted(true);
        window.sessionStorage.removeItem("health-deleted");
      }
    } catch { /* storage blocked: show the usual words */ }
  }, []);
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background p-6">
      {/* Soft accent glow to lift the card off the paper background.
          Single radial gradient anchored centre-top so it doesn't
          fight with the card's elevation shadow below. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_60%)]"
      />

      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-paper-2">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center">
            <HealthMark size={48} />
          </div>
          <p className="mt-3 font-display font-medium tracking-tight text-sm ">
            health
          </p>
          <h1 className="mt-4 font-display font-medium tracking-tight text-2xl ">
            {deleted ? "Everything is deleted." : "Signed out."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {deleted
              ? "Your entries, GP page, profile and settings are gone from health. Your sign-in account at Kinde is separate: email michael@guilduk.com to have it removed too."
              : "Your entries will be here when you come back."}
          </p>

          <Button asChild className="mt-6 w-full" size="lg">
            <Link href="/api/auth/login?post_login_redirect_url=/dashboard">
              Sign back in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Link
            href="/"
            className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
