"use client";

// The demo trends screen IS the real Trends page component (canonical
// route /dashboard/me/trends — /dashboard/trends is just a redirect),
// fed by the mock data layer installed in the demo layout.
import Page from "@/app/dashboard/me/trends/page";

export default function DemoTrendsPage() {
  return <Page />;
}
