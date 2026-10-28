import { Suspense } from "react";
import DemoShell from "./_components/DemoShell";
import MockProvider from "./_mock/MockProvider";

export const metadata = {
  title: "Live demo",
  description: "A hands-on demo of Health running on sample data. Nothing is saved.",
};

// The demo frame is always visible; MockProvider wraps only the page content
// so the fake network layer is installed before the reused pages fetch.
// Suspense satisfies useSearchParams (mode=solo|family) during prerender.
export default function DemoLayout({ children }) {
  return (
    <DemoShell>
      <Suspense fallback={null}>
        <MockProvider>{children}</MockProvider>
      </Suspense>
    </DemoShell>
  );
}
