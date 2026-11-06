// The GP summary (health v2). One page, in the order the NHS suggests (docs/RESEARCH.md):
// what is happening and since when, what makes it better or worse, sleep and mood around it,
// medicines, and the person's questions.
//
// The MHRA line: this only arranges what the person wrote. It never scores, rates, interprets,
// warns or advises. The only arithmetic is ordering by date and counting the days something was
// written down, which the person could do with their own paper diary.
//
// Pure: used by /api/summary on the server, by the demo in the browser, and by the PDF.

const MOOD_WORDS = { 1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great" };
const ENERGY_WORDS = { 1: "drained", 2: "tired", 3: "steady", 4: "good energy", 5: "wired" };

const lines = (text) => String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const key = (what) => String(what ?? "").trim().toLowerCase();
const distinct = (values) => {
  const seen = new Set(); const out = [];
  for (const v of values) { const t = String(v ?? "").trim(); if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); } }
  return out;
};

export function buildSummary({ name, today, from, to, feelings = [], sleep = [], mood = [], appointment = null }) {
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const entries = feelings.filter((f) => f && f.what && inRange(f.date)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const groups = new Map();
  for (const f of entries) {
    const k = key(f.what);
    if (!groups.has(k)) groups.set(k, { what: String(f.what).trim(), since: f.date, dates: new Set(), places: [], entries: [] });
    const g = groups.get(k);
    g.dates.add(f.date);
    if (f.whereOnBody) g.places.push(f.whereOnBody);
    g.entries.push({ date: f.date, howBad: f.howBad ?? null, where: f.whereOnBody ?? null, note: f.note ?? null });
  }
  const happening = [...groups.values()].map((g) => ({
    what: g.what,
    since: g.since,
    daysWritten: g.dates.size,
    where: distinct(g.places),
    entries: g.entries,
  }));

  const dates = [...new Set(entries.map((f) => f.date))].sort();
  const sleepBy = new Map(sleep.map((s) => [s.date, s]));
  const moodBy = new Map(mood.map((m) => [m.date, m]));
  const around = dates.map((d) => {
    const s = sleepBy.get(d); const m = moodBy.get(d);
    return {
      date: d,
      sleep: s && (s.hours != null || s.quality != null) ? { hours: s.hours == null ? null : Number(s.hours), quality: s.quality ?? null } : null,
      mood: m && (m.mood || m.energy) ? { mood: MOOD_WORDS[m.mood] ?? null, energy: ENERGY_WORDS[m.energy] ?? null } : null,
    };
  }).filter((a) => a.sleep || a.mood);

  return {
    writtenBy: name || "Me",
    writtenOn: today,
    period: { from: from ?? dates[0] ?? null, to: to ?? today },
    appointmentDate: appointment?.date ?? null,
    happening,
    better: distinct(entries.map((f) => f.better)),
    worse: distinct(entries.map((f) => f.worse)),
    around,
    medicines: lines(appointment?.medicines),
    questions: lines(appointment?.questions).slice(0, 5),
    // First person: the person hands this page over themselves.
    footer: "These are my own words, written down using health. Your GP decides what this means.",
  };
}
