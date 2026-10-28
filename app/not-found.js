import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import EtchMark from "@/components/EtchMark";

// Branded 404 page (Next.js App Router convention: any thrown notFound()
// or unmatched route renders this). Keeps the Etch wordmark + paper
// background instead of the generic Next.js black-on-white "404 — This
// page could not be found." default.
export const metadata = {
  title: "Off the page · Etch",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-paper-1 sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <EtchMark size={48} />
        </div>
        <p className="mt-3 font-serif text-sm font-semibold tracking-tight text-muted-foreground">
          Etch
        </p>
        <div className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Compass className="h-5 w-5" />
        </div>
        <h1 className="mt-4 font-serif text-2xl font-bold tracking-tight">
          Off the page.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          That URL doesn't lead anywhere we recognise. The trail's gone cold —
          might be a mistyped link or a route that's moved.
        </p>
        <div className="mt-6 flex flex-col items-stretch gap-2">
          <Button asChild>
            <Link href="/">
              Back to home
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to Today</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
