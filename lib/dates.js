export function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// Returns the YYYY-MM-DD for `daysAgo` days before today.
export function daysAgoStr(daysAgo) {
  return dateStr(addDays(new Date(), -daysAgo));
}

// Mon=0..Sun=6
export function weekIndex(d = new Date()) {
  return (d.getDay() + 6) % 7;
}

// Returns the Sunday-end of the week containing `d` as YYYY-MM-DD.
export function weekEndingStr(d = new Date()) {
  const sunday = new Date(d);
  const idx = weekIndex(d);
  sunday.setDate(d.getDate() + (6 - idx));
  return dateStr(sunday);
}

// Returns the Monday-start of the week containing `d` as YYYY-MM-DD.
export function weekStartStr(d = new Date()) {
  const monday = new Date(d);
  const idx = weekIndex(d);
  monday.setDate(d.getDate() - idx);
  return dateStr(monday);
}

export function prettyDate(dateString) {
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
