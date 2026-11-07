// Delete everything (UK GDPR right to erasure): every row the person owns goes, and nobody else's does.
import { test, expect, afterAll } from "vitest";
import pg from "pg";
import { asUser, call, today } from "./harness.mjs";
import { db } from "@/utils/dbConfig";
import { USERS, FAMILIES, MEMBERSHIPS } from "@/utils/schema";
import * as account from "@/app/api/account/route.js";
import * as feelings from "@/app/api/feelings/route.js";
import * as chat from "@/app/api/chat/route.js";
import * as sleep from "@/app/api/sleep/route.js";
import * as appointment from "@/app/api/appointment/route.js";

const tag = Math.random().toString(36).slice(2, 8);
const GONE = { id: `kp_del_${tag}`, email: `del_${tag}@example.org`, name: "Dayo" };
const STAYS = { id: `kp_keep_${tag}`, email: `keep_${tag}@example.org`, name: "Kemi" };
const raw = new pg.Pool({ connectionString: process.env.PG_URL || "postgres://postgres:postgres@127.0.0.1:6543/health_test" });
const d = today();

afterAll(async () => { await raw.end(); });

async function setUp(p) {
  const fam = `fam_${p.id}`;
  await db.insert(USERS).values({ id: p.id, email: p.email, displayName: p.name, visibility: {}, healthConsentAt: new Date() });
  await db.insert(FAMILIES).values({ id: fam, name: "My space", ownerUserId: p.id });
  await db.insert(MEMBERSHIPS).values({ userId: p.id, familyId: fam, role: "owner" });
  asUser(p);
  await call(feelings.POST, { method: "POST", body: { date: d, what: `Cough ${p.name}`, howBad: "mild" } });
  await call(chat.POST, { method: "POST", body: { content: `Journal ${p.name}`, date: d } });
  await call(sleep.POST, { method: "POST", body: { date: d, hours: 7 } });
  await call(appointment.PUT, { method: "PUT", body: { questions: `Question ${p.name}` } });
  return fam;
}

/** Every row anywhere in the database that mentions this person or their space. */
async function rowsFor(id, fam) {
  const cols = await raw.query(`select table_name, column_name from information_schema.columns
    where table_schema = 'public' and column_name in ('user_id','id','owner_user_id','family_id','viewer_id','viewee_id','invited_by_user_id')`);
  let n = 0;
  for (const { table_name, column_name } of cols.rows) {
    const v = column_name === "family_id" ? fam : id;
    const r = await raw.query(`select count(*)::int as c from "${table_name}" where "${column_name}"::text = $1`, [v]);
    n += r.rows[0].c;
  }
  return n;
}

test("every table with a user_id column is on the delete list", async () => {
  const r = await raw.query(`select distinct table_name from information_schema.columns where table_schema = 'public' and column_name = 'user_id'`);
  const sqlNames = r.rows.map((x) => x.table_name).filter((t) => t !== "memberships").sort();
  const S = await import("@/utils/schema");
  const { getTableName } = await import("drizzle-orm");
  const listed = account.OWNED_TABLES.map((n) => getTableName(S[n])).sort();
  expect(listed).toEqual(sqlNames);
});

test("delete everything removes all of the person's rows and none of anyone else's", async () => {
  const famGone = await setUp(GONE);
  const famStays = await setUp(STAYS);
  expect(await rowsFor(GONE.id, famGone)).toBeGreaterThan(5);
  const before = await rowsFor(STAYS.id, famStays);

  asUser(GONE);
  const refused = await call(account.DELETE, { method: "DELETE", body: {} });
  expect(refused.status).toBe(400);
  const r = await call(account.DELETE, { method: "DELETE", body: { confirm: "delete everything" } });
  expect(r.status, r.text).toBe(200);

  expect(await rowsFor(GONE.id, famGone)).toBe(0);
  expect(await rowsFor(STAYS.id, famStays)).toBe(before);
});
