"use client";

// The demo me/reminders screen IS the real page component, fed by the mock
// data layer installed in the demo layout. Reused verbatim so the demo
// always matches the real app.
import Page from "@/app/dashboard/me/reminders/page";

export default function DemoMeRemindersPage() {
  return <Page />;
}
