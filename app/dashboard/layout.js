import { Suspense } from "react";
import Sidebar from "./_components/Sidebar";
import TopBar from "./_components/TopBar";
import BottomNav from "./_components/BottomNav";
import ViewingBanner from "./_components/ViewingBanner";
import { LogProvider } from "@/components/log/LogProvider";

// `h-[100dvh]` instead of h-screen so mobile browsers don't include the
// dynamic URL bar / chrome in the viewport - that's the cause of the
// "scroll twice to see the bottom" feeling on phones.
//
// `overscroll-contain` on the inner scroller keeps scroll chains from bubbling
// to the body (which is already overflow-hidden, but belt-and-braces against
// rubber-band on iOS Safari).
//
// `overflow-x-hidden` on <main> stops the whole page from being able to
// scroll sideways when something inside is wider than the viewport (the
// classic iPhone-Safari "page is shifted right" symptom). Combined with
// `min-w-0` on the column above, anything that wants to be too wide
// truncates instead of breaking the layout.
//
// `pb-24` (vs old pb-20) gives the bottom nav + safe-area inset enough room.
export default function DashboardLayout({ children }) {
  return (
    <LogProvider>
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* Skip-to-content for keyboard / screen-reader users. Hidden visually
          until focused, then pops to top-left. WCAG 2.4.1. */}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {/* Suspense boundary required because ViewingBanner uses
            useSearchParams - Next 14 needs it wrapped or the whole route
            becomes dynamic. */}
        <Suspense fallback={null}>
          <ViewingBanner />
        </Suspense>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-28 md:pb-0"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
    </LogProvider>
  );
}
