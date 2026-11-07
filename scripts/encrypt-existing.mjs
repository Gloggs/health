// One-off: encrypts words saved before encryption was switched on (6 November 2026).
//
// New and edited entries are encrypted automatically (lib/crypt.js). Rows saved earlier are still plain
// text, and the app reads them as they are. This script finds those rows and encrypts them in place, so
// the database holds no readable words at all. It is safe to run more than once: encrypted values are
// skipped. It changes nothing else.
//
// Run it from your own computer, with the same values the live app uses, in .env.local:
//   DATABASE_URL     the live database
//   HEALTH_DATA_KEY  the same key as in the hosting settings (a different key makes the words unreadable)
//
//   node scripts/encrypt-existing.mjs           shows how many rows would change, and changes nothing
//   node scripts/encrypt-existing.mjs --apply   encrypts them
import pg from "pg";
import dotenv from "dotenv";
import { encryptText, decryptText, isEncrypted } from "../lib/crypt.js";

// Every column declared with encryptedText in utils/schema.jsx. tests/privacy/encrypt-existing.test.mjs
// fails if this list and the schema ever disagree.
export const ENCRYPTED_COLUMNS = {
  feelings: ["what", "where_on_body", "how_bad", "better", "worse", "note"],
  appointments: ["questions", "medicines"],
  sleep_logs: ["note"],
  mood_logs: ["note"],
  body_metrics: ["note"],
  meal_logs: ["description"],
  cardio_logs: ["note"],
  chat_messages: ["content"],
  daily_check_ins: ["note"],
  sessions: ["notes"],
  user_context: ["goals", "restrictions", "preferences"],
};

export async function encryptExisting(client, { apply = false, log = console.log } = {}) {
  let total = 0;
  for (const [table, columns] of Object.entries(ENCRYPTED_COLUMNS)) {
    for (const column of columns) {
      const { rows } = await client.query(
        `select id, "${column}" as value from "${table}" where "${column}" is not null and "${column}" not like 'enc:v1:%'`
      );
      if (!rows.length) continue;
      total += rows.length;
      log(`${table}.${column}: ${rows.length} to encrypt`);
      if (!apply) continue;
      for (const { id, value } of rows) {
        const sealed = encryptText(value);
        if (decryptText(sealed) !== value) throw new Error(`Check failed for ${table}.${column} row ${id}; nothing more was changed.`);
        // Only update if the row is still the same plain value, so an edit made meanwhile is never overwritten.
        await client.query(`update "${table}" set "${column}" = $1 where id = $2 and "${column}" = $3`, [sealed, id, value]);
      }
    }
  }
  return total;
}

const runDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (runDirectly) {
  dotenv.config({ path: ".env.local" });
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL || !process.env.HEALTH_DATA_KEY) {
    console.error("Set DATABASE_URL and HEALTH_DATA_KEY in .env.local first.");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const n = await encryptExisting(client, { apply });
    console.log(apply ? `Done: ${n} values encrypted.` : `${n} values would be encrypted. Run again with --apply to do it.`);
  } finally {
    await client.end();
  }
}

export { isEncrypted };
