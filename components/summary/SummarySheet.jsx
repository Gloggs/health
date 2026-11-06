// The GP summary as one page on screen and on paper. Shows exactly what lib/summary.js arranged:
// the person's own words, in the NHS's order. No colour coding, no scores, no warnings.
function longDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function shortDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function SummarySheet({ s }) {
  const empty = s.happening.length === 0;
  return (
    <article className="print-sheet space-y-6 bg-background p-6 text-foreground sm:p-8" aria-label="GP summary">
      <header className="space-y-1 border-b border-border pb-4">
        <h2 className="font-display font-medium tracking-tight text-2xl">For my GP</h2>
        <p className="text-sm text-muted-foreground">
          {s.writtenBy}. Written down from {longDate(s.period.from)} to {longDate(s.period.to)}.
          {s.appointmentDate ? ` Appointment on ${longDate(s.appointmentDate)}.` : ""}
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-lg font-medium">What is happening</h3>
        {empty ? <p className="text-muted-foreground">Nothing written down in this period.</p> : s.happening.map((h) => (
          <div key={h.what} className="space-y-1">
            <p className="font-medium">
              {h.what}{h.where.length ? ` (${h.where.join(", ")})` : ""}. Since {longDate(h.since)}, written down on {h.daysWritten} {h.daysWritten === 1 ? "day" : "days"}.
            </p>
            <ul className="space-y-0.5 text-sm">
              {h.entries.map((e, i) => (
                <li key={i}>{shortDate(e.date)}{e.howBad ? `: ${e.howBad}` : ""}{e.note ? `. ${e.note}` : ""}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {s.better.length || s.worse.length ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-lg font-medium">What makes it better</h3>
            {s.better.length ? <ul className="mt-1 list-disc pl-5 text-sm">{s.better.map((b) => <li key={b}>{b}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Nothing written down.</p>}
          </div>
          <div>
            <h3 className="text-lg font-medium">What makes it worse</h3>
            {s.worse.length ? <ul className="mt-1 list-disc pl-5 text-sm">{s.worse.map((w) => <li key={w}>{w}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Nothing written down.</p>}
          </div>
        </section>
      ) : null}

      {s.around.length ? (
        <section>
          <h3 className="text-lg font-medium">Sleep and mood on those days</h3>
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr className="border-b border-border"><th className="py-1 font-medium">Day</th><th className="py-1 font-medium">Sleep</th><th className="py-1 font-medium">Mood</th></tr></thead>
            <tbody>
              {s.around.map((a) => (
                <tr key={a.date} className="border-b border-border">
                  <td className="py-1">{shortDate(a.date)}</td>
                  <td className="py-1">{a.sleep ? [a.sleep.hours != null ? `${a.sleep.hours} hours` : null, a.sleep.quality ? `rated ${a.sleep.quality} of 5` : null].filter(Boolean).join(", ") : ""}</td>
                  <td className="py-1">{a.mood ? [a.mood.mood, a.mood.energy].filter(Boolean).join(", ") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-lg font-medium">My medicines</h3>
          {s.medicines.length ? <ul className="mt-1 list-disc pl-5 text-sm">{s.medicines.map((m) => <li key={m}>{m}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">None written down.</p>}
        </div>
        <div>
          <h3 className="text-lg font-medium">My questions</h3>
          {s.questions.length ? <ol className="mt-1 list-decimal pl-5 text-sm">{s.questions.map((q) => <li key={q}>{q}</li>)}</ol> : <p className="mt-1 text-sm text-muted-foreground">None written down.</p>}
        </div>
      </section>

      <footer className="border-t border-border pt-3 text-sm text-muted-foreground">{s.footer}</footer>
    </article>
  );
}
