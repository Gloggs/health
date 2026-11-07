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
  NODE_ENV: process.env.NODE_ENV ?? "development",
};


export function requireDatabaseUrl() {
  return required("DATABASE_URL");
}
