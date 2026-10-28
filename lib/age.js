/**
 * Derive a person's age in whole years from a date-of-birth string or Date.
 * Returns null when the input is missing or unparseable, or a negative
 * number when the DOB is in the future (caller should treat that as
 * invalid, not as a real age).
 *
 * Why this lives in its own file: we store DOB rather than age so the
 * number stays accurate forever (no birthday-bump required). Every place
 * the UI shows an age - profile card, Family list, weekly summary - goes
 * through this helper so they agree.
 */
export function computeAge(dateOfBirth, now = new Date()) {
  if (dateOfBirth == null || dateOfBirth === "") return null;
  const raw = typeof dateOfBirth === "string"
    ? new Date(dateOfBirth.length === 10 ? dateOfBirth + "T00:00:00" : dateOfBirth)
    : new Date(dateOfBirth);
  if (Number.isNaN(raw.getTime())) return null;

  let age = now.getFullYear() - raw.getFullYear();
  const monthDelta = now.getMonth() - raw.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < raw.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Inclusive bounds for a "plausibly human" DOB: at least 1 year old, at
 * most 130. Used to seed the date picker's min/max in the onboarding
 * wizard and to validate /api/users/me PUTs server-side.
 */
export function maxAllowedDob(now = new Date()) {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 1);
  return formatYmd(d);
}

export function minAllowedDob(now = new Date()) {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 130);
  return formatYmd(d);
}

function formatYmd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
