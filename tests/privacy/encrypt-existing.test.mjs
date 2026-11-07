// scripts/encrypt-existing.mjs: older plain-text words are encrypted in place, and nothing else changes.
import { test, expect, afterAll } from "vitest";
import pg from "pg";
import { getTableName, getTableColumns } from "drizzle-orm";
import * as S from "@/utils/schema";
import { db } from "@/utils/dbConfig";
import { ENCRYPTED_COLUMNS, encryptExisting } from "@/scripts/encrypt-existing.mjs";
import { decryptText } from "@/lib/crypt.js";

const raw = new pg.Pool({ connectionString: process.env.PG_URL || "postgres://postgres:postgres@127.0.0.1:6543/health_test" });
afterAll(async () => { await raw.end(); });

test("the script's list matches every encrypted column in the schema", () => {
  const fromSchema = {};
  for (const t of Object.values(S)) {
    let cols;
    try { cols = getTableColumns(t); } catch { continue; }
    if (!cols) continue;
    for (const c of Object.values(cols)) {
      if (c.columnType === "PgCustomColumn") (fromSchema[getTableName(t)] ??= []).push(c.name);
    }
  }
  const sorted = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v].sort()]).sort());
  expect(sorted(ENCRYPTED_COLUMNS)).toEqual(sorted(fromSchema));
});

test("a plain-text row from before encryption is encrypted in place, and still reads the same", async () => {
  const tag = Math.random().toString(36).slice(2, 8);
  await db.insert(S.USERS).values({ id: `kp_old_${tag}`, email: `old_${tag}@example.org` });
  const ins = await raw.query(
    `insert into feelings (family_id, user_id, date, what, note) values ($1, $2, current_date, 'OLD-PLAIN-WHAT', 'OLD-PLAIN-NOTE') returning id`,
    [`fam_old_${tag}`, `kp_old_${tag}`]
  );
  const id = ins.rows[0].id;

  const dry = await encryptExisting(raw, { apply: false, log: () => {} });
  expect(dry).toBeGreaterThanOrEqual(2);
  expect((await raw.query("select what from feelings where id = $1", [id])).rows[0].what).toBe("OLD-PLAIN-WHAT");

  await encryptExisting(raw, { apply: true, log: () => {} });
  const after = (await raw.query("select what, note from feelings where id = $1", [id])).rows[0];
  expect(after.what.startsWith("enc:v1:")).toBe(true);
  expect(decryptText(after.what)).toBe("OLD-PLAIN-WHAT");
  expect(decryptText(after.note)).toBe("OLD-PLAIN-NOTE");
  expect(await encryptExisting(raw, { apply: false, log: () => {} })).toBe(0);
});
