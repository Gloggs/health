"use client";

// The demo chat screen IS the real page component, fed by the mock
// data layer installed in the demo layout. Reused verbatim so the demo
// always matches the real app.
import Page from "@/app/dashboard/chat/page";

export default function DemoChatPage() {
  return <Page />;
}
