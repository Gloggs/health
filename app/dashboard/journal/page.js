"use client";

import PageHeader from "../_components/PageHeader";
import { JournalView } from "../_components/ChatViews";

// Log > Journal: private notes. Nobody else can read them.
export default function JournalPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
      <PageHeader fallback="/dashboard/log" title="Journal" />
      <p className="text-muted-foreground">Private. Only you can read it.</p>
      <JournalView />
    </div>
  );
}
