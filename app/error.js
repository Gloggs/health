"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import HealthMark from "@/components/HealthMark";

// Route-segment error boundary. Renders any time a page / layout under
// the app/ tree throws during render or in a Server Action. Catches the
// long tail of "something exploded" cases so the user sees an Etch-
// branded recovery surface instead of Vercel's raw 500.
//
// Doesn't catch:
//   - Middleware crashes (handled by the try/catch wrap in middleware.js)
//   - Errors in app/layout.js itself (handled by app/global-error.js)
//   - API route errors (those return JSON via the withFamily wrapper)
export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    // Log so we can dig into recurring crashes in Vercel logs.
    console.error("[app/error] caught:", error?.message ?? error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-paper-2 sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <HealthMark size={48} />
        </div>
        <p className="mt-3 font-display uppercase text-sm font-semibold text-muted-foreground">
          Health
        </p>
        <div className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="mt-4 font-display uppercase text-2xl font-bold ">
          Something cracked.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Health hit an unexpected error rendering this page. Your data's safe,
          entries only write when you tap.
        </p>
        {error?.digest ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground/70 tabular-nums">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col items-stretch gap-2">
          <Button onClick={() => reset()}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Today
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
