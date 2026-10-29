/** "Michael Gloggs" -> "MG", "You" -> "Y", "" -> "?". Used everywhere a person is shown as a square. */
export function initialsOf(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
