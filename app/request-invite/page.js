"use client";

import { useState } from "react";
import Link from "next/link";
import { LoginLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import HealthMark from "@/components/HealthMark";

// Public request-an-invite page. Posts to /api/invite-requests, which emails
// the founder. No account is created here; approval is manual. Client
// component because it owns the form state + submit lifecycle.

const INPUT =
  "mt-1.5 w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm transition-colors focus:border-primary";

export default function RequestInvitePage() {
  const [mode, setMode] = useState("family");
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (status === "submitting") return;
    const fd = new FormData(e.currentTarget);

    // Honeypot tripped: pretend success, send nothing.
    if (fd.get("website")) {
      setStatus("done");
      return;
    }

    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/invite-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name") || "",
          email: fd.get("email") || "",
          mode,
          note: fd.get("note") || "",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Something went wrong. Please try again.");
      }
      setStatus("done");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Health, home" className="flex items-center gap-2.5">
          <HealthMark size={34} />
          <span className="leading-none">
            <span className="block font-display uppercase text-lg font-bold">Health</span>
          </span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <LoginLink postLoginRedirectURL="/dashboard">Log in</LoginLink>
        </Button>
      </header>

      <main className="mx-auto max-w-xl px-6 pb-20">
        <Link
          href="/start"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mt-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Private beta
          </span>
          <h1 className="mt-4 font-display uppercase text-4xl font-bold ">Request an invite</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Health is invite-only for now. Tell us a little about you and we'll be in
            touch when a spot opens. In the meantime, the{" "}
            <Link href="/start" className="font-semibold text-primary hover:underline">
              live demo
            </Link>{" "}
            is open to everyone.
          </p>
        </div>

        {status === "done" ? (
          <div className="mt-8 rounded-2xl border bg-card p-8 text-center shadow-paper-1">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <h2 className="mt-4 font-display uppercase text-2xl font-bold">Request sent</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Thanks. We review requests by hand, so it may take a few days. We'll
              email you when a spot opens.
            </p>
            <div className="mt-6 flex flex-col items-stretch gap-2">
              <Button asChild>
                <Link href="/start">Explore the demo</Link>
              </Button>
              <Link
                href="/"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to home
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 rounded-2xl border bg-card p-6 shadow-paper-1"
          >
            {/* Honeypot: bots fill this; humans never see it. */}
            <div className="sr-only" aria-hidden="true">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold">Your name</span>
              <input name="name" type="text" required placeholder="Jordan Rivers" className={INPUT} />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold">Email</span>
              <input name="email" type="email" required placeholder="you@example.com" className={INPUT} />
            </label>

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">How would you use it?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { value: "solo", label: "Just me" },
                  { value: "family", label: "With my household" },
                ].map((opt) => {
                  const selected = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      aria-pressed={selected}
                      className={
                        "rounded-xl border py-2.5 text-center text-sm font-medium transition-colors " +
                        (selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent hover:text-accent-foreground")
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="mt-4 block">
              <span className="text-sm font-semibold">
                Anything you'd like us to know?{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <textarea
                name="note"
                rows={3}
                placeholder="What are you hoping to track?"
                className={INPUT + " resize-none"}
              />
            </label>

            {status === "error" && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="mt-6 w-full" disabled={status === "submitting"}>
              {status === "submitting" ? "Sending…" : "Request an invite"}
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              We review requests by hand, so it may take a few days. We'll only use
              your email to contact you about the beta. No spam, ever.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
