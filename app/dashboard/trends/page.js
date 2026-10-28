import { redirect } from "next/navigation";

// Canonical Trends route is /dashboard/me/trends. This one redirects so
// every entry point lands on the same URL (single source of truth for
// SWR cache, breadcrumbs, history).
export default function TrendsRedirect() {
  redirect("/dashboard/me/trends");
}
