"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Eye, ArrowLeft } from "lucide-react";
import GlobalApi from "@/app/_services/GlobalApi";

// Top-of-page strip that appears any time the URL carries ?viewing=<id>.
// It pins the viewing context across every dashboard page so the user
// always sees whose data they're looking at and can drop back to their
// own view in one tap.
//
// Render strategy: the banner takes a fixed slot in dashboard/layout.js so
// it sits above <main> and shifts page content down rather than overlaying
// it. That avoids covering the first-fold content on the Today page.
//
// Data fetch: a single GET /api/users/me?viewing=<id> resolves the viewee's
// displayName. We don't pull /api/family for this - one row is cheaper than
// the whole roster and the banner doesn't need the rest of the tile data.
//
// Edge cases:
//   - Unknown viewing id -> server clamps to viewer, server returns
//     isViewingOther: false -> we hide the banner.
//   - viewing=<own id> -> server clamps -> banner hidden.
export default function ViewingBanner() {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const viewingId = search.get("viewing");
  const [viewee, setViewee] = useState(null);

  useEffect(() => {
    if (!viewingId) {
      setViewee(null);
      return;
    }
    let cancelled = false;
    GlobalApi.GetMeViewing(viewingId)
      .then((r) => {
        if (cancelled) return;
        // Server-side clamp: when the id is unknown or names the viewer,
        // isViewingOther comes back false - treat as "no banner".
        if (r.data?.isViewingOther) setViewee(r.data);
        else setViewee(null);
      })
      .catch(() => {
        if (!cancelled) setViewee(null);
      });
    return () => {
      cancelled = true;
    };
  }, [viewingId]);

  if (!viewingId || !viewee) return null;

  const backToSelf = () => {
    // Strip the viewing param while keeping the current pathname. Pushing
    // a clean pathname is enough - Next.js navigates without the search.
    router.push(pathname);
  };

  return (
    <div className="border-b bg-primary/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-screen-lg items-center gap-2">
        <Eye className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-foreground">
          Viewing <span className="font-semibold">{viewee.displayName || "another member"}</span>
        </span>
        <button
          type="button"
          onClick={backToSelf}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-card px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to my view</span>
        </button>
      </div>
    </div>
  );
}
