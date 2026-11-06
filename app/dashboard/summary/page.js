"use client";
// For my GP (health v2): the appointment details the NHS suggests bringing, and the one-page summary of what the
// person wrote down. Show it on the phone, print it, or download a PDF. Private: only ever the person's own.
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";
import SummarySheet from "@/components/summary/SummarySheet";

const PERIODS = [[2, "2 weeks"], [4, "4 weeks"], [8, "8 weeks"]];

export default function SummaryPage() {
  const [weeks, setWeeks] = useState(4);
  const [summary, setSummary] = useState(null);
  const [appt, setAppt] = useState({ date: "", questions: "", medicines: "" });
  const [saving, setSaving] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);

  const load = (w = weeks) => GlobalApi.GetSummary({ weeks: w }).then((r) => setSummary(r.data)).catch(() => setSummary(false));
  useEffect(() => {
    GlobalApi.GetAppointment().then((r) => { if (r.data) setAppt({ date: r.data.date ?? "", questions: r.data.questions ?? "", medicines: r.data.medicines ?? "" }); }).catch(() => {});
  }, []);
  useEffect(() => { load(weeks); }, [weeks]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAppt(e) {
    e.preventDefault();
    setSaving(true);
    try { await GlobalApi.SaveAppointment({ ...appt, date: appt.date || null }); toast.success("Saved."); load(); }
    catch (err) { toast.error(err?.response?.data?.error ?? "Could not save. Please try again."); }
    finally { setSaving(false); }
  }

  async function downloadPdf() {
    setBusyPdf(true);
    try { const { downloadSummaryPdf } = await import("@/components/summary/summaryPdf"); await downloadSummaryPdf(summary); }
    catch { toast.error("Could not make the PDF. Printing still works."); }
    finally { setBusyPdf(false); }
  }

  async function downloadFhir() {
    try {
      const res = await fetch("/api/export/fhir", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(new Blob([await res.text()], { type: "application/fhir+json" }));
      const a = document.createElement("a"); a.href = url; a.download = "health-fhir-export.json";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { toast.error("Could not make the file. Please try again."); }
  }

  const field = "w-full border border-input bg-background px-3 text-base";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6">
      <header className="no-print space-y-2">
        <h1 className="font-display font-medium tracking-tight text-3xl sm:text-4xl">For my GP</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          One page with what you wrote down, your medicines and your questions. Show it on your phone, print it, or save it as a PDF.
        </p>
      </header>

      <form onSubmit={saveAppt} className="no-print space-y-4 bg-card p-5" aria-labelledby="appt-title">
        <h2 id="appt-title" className="font-display font-medium tracking-tight text-2xl">My appointment</h2>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">When is it? <span className="font-normal text-muted-foreground">(optional)</span></span>
          <input type="date" className={`${field} h-12`} value={appt.date} onChange={(e) => setAppt({ ...appt, date: e.target.value })} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">My 2 or 3 most important questions <span className="font-normal text-muted-foreground">(one per line)</span></span>
          <textarea className={`${field} min-h-24 py-2`} value={appt.questions} onChange={(e) => setAppt({ ...appt, questions: e.target.value })} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">My medicines, including vitamins and supplements <span className="font-normal text-muted-foreground">(one per line)</span></span>
          <textarea className={`${field} min-h-24 py-2`} value={appt.medicines} onChange={(e) => setAppt({ ...appt, medicines: e.target.value })} />
        </label>
        <button type="submit" disabled={saving} className="h-12 w-full bg-primary px-6 text-base font-medium text-primary-foreground disabled:opacity-60 sm:w-auto">
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      <section className="space-y-4" aria-label="Summary">
        <div className="no-print flex flex-wrap items-center gap-3">
          <div role="group" aria-label="How far back" className="flex">
            {PERIODS.map(([w, label]) => (
              <button key={w} type="button" aria-pressed={weeks === w} onClick={() => setWeeks(w)}
                className={weeks === w ? "h-11 bg-primary px-4 text-sm font-medium text-primary-foreground" : "h-11 bg-secondary px-4 text-sm font-medium"}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => window.print()} disabled={!summary} className="h-11 bg-secondary px-4 text-sm font-medium">Print</button>
          <button type="button" onClick={downloadPdf} disabled={!summary || busyPdf} className="h-11 bg-secondary px-4 text-sm font-medium">{busyPdf ? "Making the PDF…" : "Download PDF"}</button>
        </div>
        <p className="no-print text-sm text-muted-foreground">
          Need it for a health record system? <button type="button" onClick={downloadFhir} className="underline underline-offset-4">Download your entries in FHIR</button>, the data format the NHS uses. health sends it nowhere.
        </p>
        {summary === null ? <p className="text-muted-foreground">Loading…</p>
          : summary === false ? <p className="text-muted-foreground">Could not load the summary. Please try again.</p>
          : <SummarySheet s={summary} />}
        <p className="no-print text-sm text-muted-foreground">
          Something missing? <Link href="/dashboard/feel" className="underline underline-offset-4">Add how you feel</Link>.
        </p>
      </section>
    </div>
  );
}
