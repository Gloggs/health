import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/**
 * Drizzle Kit configuration for Etch.
 *
 * Workflow (from Milestone 03 Phase A.2 onwards):
 *
 *   1. Edit `utils/schema.jsx` with your schema change
 *   2. `npm run db:generate -- --name <short-description>`
 *      Produces a numbered .sql file in `./drizzle/` representing the diff.
 *   3. Review the generated SQL. Edit it by hand if needed (e.g. to make a
 *      column nullable before backfilling, then NOT NULL in a second step).
 *   4. `git add drizzle/` and commit the migration alongside the schema change.
 *   5. `npm run db:migrate` applies pending migrations on deploy.
 *
 * The old `npm run db:push` is kept for emergency dev iteration but should
 * NOT be used against production after this point - it bypasses the migration
 * history and breaks the contract `db:migrate` relies on.
 *
 * First-time setup for an existing DB (Etch's case as of 2026-05-22):
 *   - Run `db:generate --name 0000_baseline` once to create a baseline
 *     migration representing the current schema
 *   - On the prod database, manually insert a row into __drizzle_migrations
 *     to mark the baseline as already-applied (the tables already exist)
 *   - From that point forward, normal generate -> migrate flow works
 *
 * See README.md "Schema migrations" section for the full workflow.
 */
export default defineConfig({
  schema: "./utils/schema.jsx",
  dialect: "postgresql",
  // Versioned migrations live here. Committed to git. The whole point of
  // switching off db:push is so this folder is the source of truth for
  // "what the schema is supposed to look like" rather than the live DB.
  out: "./drizzle",
  // Custom table name in case we ever want to support multiple branches /
  // schemas in one DB. Default is `__drizzle_migrations` in the public schema.
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL?.trim(),
  },
});
