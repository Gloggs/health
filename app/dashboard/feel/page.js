"use client";
// How I feel (health v2, 6 November 2026). The job: "When something is not right, I want to show my GP what has
// been happening, clearly, in the ten minutes I get." The fields follow the NHS's own advice (docs/RESEARCH.md):
// what is happening, since when, what makes it better or worse. The person's own words only: health never scores,
// interprets or advises, and these entries are never shared with family.
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";
import { todayDateStr } from "@/lib/dates";

const HOW_BAD = [["mild", "Mild"], ["moderate", "Moderate"], ["bad", "Bad"]];
const EMPTY = { what: "", whereOnBody: "", howBad: "", better: "", worse: "", note: "" };

function longDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
}

export default function FeelPage() {
  const [form, setForm] = useState({ ...EMPTY, date: todayDateStr() });
  const [entries, setEntries] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const load = () => GlobalApi.GetFeelings().then((r) => setEntries(r.data)).catch(() => setEntries([]));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    if (!form.what.trim()) { toast.error("Please say what is going on, in a few words."); return; }
    setSaving(true);
    try {
      await GlobalApi.AddFeeling({ ...form, howBad: form.howBad || null });
      toast.success("Saved. Only you can see this.");
      setForm({ ...EMPTY, date: todayDateStr() });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error ?? "Could not save. Please try again.");
    } finally { setSaving(false); }
  }

  async function remove(id) {
    try { await GlobalApi.DeleteFeeling(id); load(); toast.success("Deleted."); }
    catch { toast.error("Could not delete. Please try again."); }
  }

  const field = "h-12 w-full border border-input bg-background px-3 text-base";
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display font-medium tracking-tight text-3xl sm:text-4xl">How I feel</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Write down what is going on, in your own words, so you can show your GP. Only you can see this.
        </p>
      </header>

      <form onSubmit={save} className="space-y-5 bg-card p-5" aria-label="Add how you feel">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">What is going on?</span>
          <input className={field} value={form.what} onChange={set("what")} maxLength={80} placeholder="For example, a headache" autoComplete="off" />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Where? <span className="font-normal text-muted-foreground">(optional)</span></span>
            <input className={field} value={form.whereOnBody} onChange={set("whereOnBody")} maxLength={60} placeholder="For example, my forehead" autoComplete="off" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">When?</span>
            <input className={field} type="date" value={form.date} max={todayDateStr()} onChange={set("date")} />
          </label>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">How bad is it? <span className="font-normal text-muted-foreground">(your word)</span></legend>
          <div className="grid grid-cols-3 gap-2">
            {HOW_BAD.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={form.howBad === value}
                onClick={() => setForm((f) => ({ ...f, howBad: f.howBad === value ? "" : value }))}
                className={form.howBad === value ? "h-12 bg-primary text-base font-medium text-primary-foreground" : "h-12 bg-background text-base font-medium"}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">What makes it better?</span>
            <input className={field} value={form.better} onChange={set("better")} placeholder="For example, a rest" autoComplete="off" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">What makes it worse?</span>
            <input className={field} value={form.worse} onChange={set("worse")} placeholder="For example, screens" autoComplete="off" />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Anything else? <span className="font-normal text-muted-foreground">(optional)</span></span>
          <textarea className="min-h-24 w-full border border-input bg-background px-3 py-2 text-base" value={form.note} onChange={set("note")} />
        </label>
        <button type="submit" disabled={saving} className="h-12 w-full bg-primary px-6 text-base font-medium text-primary-foreground disabled:opacity-60 sm:w-auto">
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      <section aria-labelledby="so-far" className="space-y-3">
        <h2 id="so-far" className="font-display font-medium tracking-tight text-2xl">So far</h2>
        {entries === null ? <p className="text-muted-foreground">Loading…</p>
          : entries.length === 0 ? <p className="text-muted-foreground">Nothing written down yet.</p>
          : (
            <ol className="space-y-2">
              {entries.map((f) => (
                <li key={f.id} className="bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-lg font-medium">{f.what}{f.whereOnBody ? `, ${f.whereOnBody}` : ""}</p>
                    <p className="shrink-0 text-sm text-muted-foreground">{longDate(f.date)}</p>
                  </div>
                  <dl className="mt-1 space-y-0.5 text-sm">
                    {f.howBad ? <div><dt className="inline text-muted-foreground">How bad: </dt><dd className="inline">{f.howBad}</dd></div> : null}
                    {f.better ? <div><dt className="inline text-muted-foreground">Better with: </dt><dd className="inline">{f.better}</dd></div> : null}
                    {f.worse ? <div><dt className="inline text-muted-foreground">Worse with: </dt><dd className="inline">{f.worse}</dd></div> : null}
                    {f.note ? <div><dt className="inline text-muted-foreground">Note: </dt><dd className="inline">{f.note}</dd></div> : null}
                  </dl>
                  <button type="button" onClick={() => remove(f.id)} className="mt-2 text-sm underline underline-offset-4">Delete</button>
                </li>
              ))}
            </ol>
          )}
        <p className="text-sm text-muted-foreground">
          Your GP decides what this means. health only keeps your words.{" "}
          <Link href="/dashboard/summary" className="underline underline-offset-4">See it for my GP</Link>
        </p>
      </section>
    </div>
  );
}
