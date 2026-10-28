"use client";

// The demo log/body screen IS the real page component, fed by the mock
// data layer installed in the demo layout. Reused verbatim so the demo
// always matches the real app.
import Page from "@/app/dashboard/log/body/page";

export default function DemoLogBodyPage() {
  return <Page />;
}
