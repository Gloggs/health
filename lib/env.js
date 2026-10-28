/**
 * Centralised, server-only environment variable access.
 */

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Add it to .env.local; see .env.example for the full list.`
    );
  }
  return value;
}

function optional(name, fallback = "") {
  return process.env[name] ?? fallback;
}

export const env = {
  DATABASE_URL: optional("DATABASE_URL"),
  // Comma-separated list of emails allowed to use the family app. Anyone
  // signing in via Kinde whose email isn't on this list is bounced to a
  // /not-authorized page. Edit in Vercel → Settings → Environment Variables.
  // Empty during the transition window so the migration can run; set this
  // to lock down before sharing the URL with family.
  FAMILY_EMAILS: optional("FAMILY_EMAILS"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};

// Parse FAMILY_EMAILS into a lowercased Set for O(1) lookup. Whitespace and
// blank entries are tolerated.
export function getFamilyEmailAllowlist() {
  const raw = env.FAMILY_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function requireDatabaseUrl() {
  return required("DATABASE_URL");
}
