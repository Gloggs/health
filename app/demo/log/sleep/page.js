"use client";

// The demo log/sleep screen IS the real page component, fed by the mock
// data layer installed in the demo layout. Reused verbatim so the demo
// always matches the real app.
import Page from "@/app/dashboard/log/sleep/page";

export default function DemoLogSleepPage() {
  return <Page />;
}
