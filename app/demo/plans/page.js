"use client";

// The demo plans screen IS the real page component, fed by the mock
// data layer installed in the demo layout. Reused verbatim so the demo
// always matches the real app.
import Page from "@/app/dashboard/plans/page";

export default function DemoPlansPage() {
  return <Page />;
}
