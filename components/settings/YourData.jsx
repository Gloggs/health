"use client";
// Settings > Your data: download everything, or delete everything (UK GDPR rights to access, portability
// and erasure). Deleting asks once more in plain words, then signs the person out.
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function YourData({ demo = false }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const r = await GlobalApi.ExportAll();
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `health-export-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("The download did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEverything() {
    if (demo) {
      toast("This is the demo, so there is nothing to delete.");
      setAsking(false);
      return;
    }
    setBusy(true);
    try {
      await axios.delete("/api/account", { data: { confirm: "delete everything" } });
      try { window.sessionStorage.setItem("health-deleted", "1"); } catch { /* the signed-out page then shows its usual words */ }
      window.location.href = "/api/auth/logout?post_logout_redirect_url=" + encodeURIComponent("/signed-out");
    } catch (e) {
      toast.error(e?.response?.data?.error ?? "Something went wrong, and not everything was deleted. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section id="your-data" aria-labelledby="your-data-title" className="space-y-3 bg-card p-5">
      <h2 id="your-data-title" className="font-display text-2xl font-medium tracking-tight">Your data</h2>
      <p className="leading-relaxed">Only you can see what you write down in health. You can take a copy of all of it, or delete all of it, at any time.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={download} disabled={busy} className="h-11 bg-secondary px-4 text-sm font-medium text-secondary-foreground">
          Download everything
        </button>
        {!asking ? (
          <button type="button" onClick={() => setAsking(true)} disabled={busy} className="h-11 px-1 text-sm font-medium underline underline-offset-4">
            Delete everything
          </button>
        ) : null}
      </div>
      {asking ? (
        <div role="alertdialog" aria-labelledby="delete-title" className="space-y-3 border border-foreground p-4">
          <p id="delete-title" className="font-medium">Delete everything you have written down in health?</p>
          <p className="text-sm leading-relaxed">This deletes your entries, your GP page, your profile and your settings straight away. It cannot be undone. You will be signed out.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={deleteEverything} disabled={busy} className="h-11 bg-primary px-4 text-sm font-medium text-primary-foreground">
              {busy ? "Deleting" : "Yes, delete everything"}
            </button>
            <button type="button" onClick={() => setAsking(false)} disabled={busy} className="h-11 bg-secondary px-4 text-sm font-medium">
              Keep my data
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
