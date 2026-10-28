/**
 * Format a timestamp as a short "time ago" string for the Family page tiles
 * ("Last seen 5 min ago"). Returns null when input is missing so the caller
 * can decide whether to render a placeholder or hide the line entirely.
 *
 * Buckets:
 *   < 60s            -> "just now"
 *   < 60min          -> "N min ago"
 *   < 24h            -> "Nh ago"
 *   same calendar day-1 -> "yesterday"
 *   < 7 days         -> "N days ago"
 *   otherwise        -> short local date ("18 May")
 *
 * Intentionally calendar-day aware for "yesterday" so e.g. 02:00 today vs
 * 23:00 last night reads as "yesterday", not "3h ago" (which would be
 * confusing when "today" rolled over an hour ago).
 */
export function formatRelative(input, now = new Date()) {
  if (input == null || input === "") return null;
  const then = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(then.getTime())) return null;

  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "just now"; // clock skew - don't show "in 5 min"
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThen = new Date(then);
  startOfThen.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday - startOfThen) / 86400000);
  if (dayDiff === 1) return "yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;

  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
