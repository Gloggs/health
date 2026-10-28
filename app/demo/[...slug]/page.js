import Link from "next/link";
import { Button } from "@/components/ui/button";

// Friendly fallback for any /demo/* path that isn't a built demo surface
// yet (e.g. a deep link rewritten from /dashboard/plans/123). Keeps the demo
// from ever 404-ing as we add surfaces one at a time.
export const metadata = { title: "Not in the demo · Etch" };

export default function DemoCatchAll() {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="font-serif text-2xl font-bold">Not in the demo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This corner of the app isn't part of the live demo yet. Everything you can
        try is a tap away.
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Button asChild>
          <Link href="/demo">Back to Today</Link>
        </Button>
        <Link href="/request-invite" className="text-xs text-primary hover:underline">
          Request full access
        </Link>
      </div>
    </div>
  );
}
