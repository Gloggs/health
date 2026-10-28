"use client";

// The demo log screen IS the real page component, fed by the mock
// data layer installed in the demo layout. Reused verbatim so the demo
// always matches the real app.
import Page from "@/app/dashboard/log/page";

export default function DemoLogPage() {
  return <Page />;
}
