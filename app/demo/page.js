"use client";

// The demo Today screen IS the real Today page component, fed by the mock
// data layer installed in the demo layout. Reused verbatim so the demo
// always matches the real app.
import Today from "@/app/dashboard/page";

export default function DemoTodayPage() {
  return <Today />;
}
