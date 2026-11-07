// health as it runs today (6 November 2026): a personal app. Family sharing is off (lib/features.js), and
// people's words are encrypted before they reach the database (lib/crypt.js). These tests use the real
// route handlers, the real middleware and a real Postgres.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import pg from "pg";
import { asUser, call, today } from "./harness.mjs";
import { db } from "@/utils/dbConfig";
import { USERS, FAMILIES, MEMBERSHIPS } from "@/utils/schema";
import { middleware } from "@/middleware.js";
import * as feelings from "@/app/api/feelings/route.js";
import * as chat from "@/app/api/chat/route.js";
import * as appointment from "@/app/api/appointment/route.js";
import * as dashboard from "@/app/api/dashboard/route.js";
import * as summary from "@/app/api/summary/route.js";
import * as familyCreate from "@/app/api/family/create/route.js";
import * as exportAll from "@/app/api/export/route.js";

const tag = Math.random().toString(36).slice(2, 8);
// S and T were in the same family before sharing was switched off, like the old test families.
const S = { id: `kp_s_${tag}`, email: `s_${tag}@example.org`, name: "Sade" };
const T = { id: `kp_t_${tag}`, email: `t_${tag}@example.org`, name: "Tolu" };
const NEW = { id: `kp_new_${tag}`, email: `new_${tag}@example.org`, name: "Nkem" };
const FAM = `fam_st_${tag}`;
const d = today();
const raw = new pg.Pool({ connectionString: process.env.PG_URL || "postgres://postgres:postgres@127.0.0.1:6543/health_test" });

beforeAll(async () => {
  const everything = { sleep: true, mood: true, meals: true, body: true, cardio: true, workouts: true, journal: true };
  await db.insert(USERS).values([
    { id: S.id, email: S.email, displayName: "Sade", visibility: everything, healthConsentAt: new Date() },
    { id: T.id, email: T.email, displayName: "Tolu", visibility: everything, healthConsentAt: new Date() },
  ]).onConflictDoNothing();
  await db.insert(FAMILIES).values({ id: FAM, name: "Old family", ownerUserId: S.id }).onConflictDoNothing();
  await db.insert(MEMBERSHIPS).values([
    { userId: S.id, familyId: FAM, role: "owner" },
    { userId: T.id, familyId: FAM, role: "member" },
  ]).onConflictDoNothing();
  asUser(S);
  const f = await call(feelings.POST, { method: "POST", body: { date: d, what: "WORDS-HEADACHE-S", howBad: "moderate", note: "WORDS-NOTE-S" } });
  expect(f.status, f.text).toBeLessThan(300);
  const j = await call(chat.POST, { method: "POST", body: { content: "WORDS-JOURNAL-S about my week", date: d } });
  expect(j.status, j.text).toBeLessThan(300);
  const a = await call(appointment.PUT, { method: "PUT", body: { date: d, questions: "WORDS-QUESTION-S", medicines: "WORDS-MEDICINE-S" } });
  expect(a.status, a.text).toBeLessThan(300);
});

afterAll(async () => { await raw.end(); });

describe("people's words are encrypted in the database", () => {
  test("the database holds only enc:v1: values, never the words", async () => {
    const f = await raw.query("select what, how_bad, note from feelings where user_id = $1", [S.id]);
    const j = await raw.query("select content from chat_messages where user_id = $1", [S.id]);
    const a = await raw.query("select questions, medicines from appointments where user_id = $1", [S.id]);
    const stored = [...f.rows, ...j.rows, ...a.rows].flatMap((r) => Object.values(r)).filter((v) => v != null);
    expect(stored.length).toBeGreaterThanOrEqual(6);
    for (const v of stored) {
      expect(v.startsWith("enc:v1:")).toBe(true);
      expect(v).not.toMatch(/WORDS-|moderate/);
    }
  });

  test("the person still reads their own words, and the GP summary and journal search work", async () => {
    asUser(S);
    const list = await call(feelings.GET, { path: "/api/feelings" });
    expect(list.json.find((x) => x.what === "WORDS-HEADACHE-S")?.note).toBe("WORDS-NOTE-S");
    const sum = await call(summary.GET, { path: "/api/summary?weeks=2" });
    expect(sum.text).toContain("WORDS-HEADACHE-S");
    expect(sum.text).toContain("WORDS-QUESTION-S");
    const found = await call(chat.GET, { path: "/api/chat?q=journal-s" });
    expect(found.json.map((r) => r.content)).toEqual(["WORDS-JOURNAL-S about my week"]);
    const none = await call(chat.GET, { path: "/api/chat?q=nothing-like-this" });
    expect(none.json).toEqual([]);
  });

  test("Download everything includes how you feel and the GP appointment, readable", async () => {
    asUser(S);
    const r = await call(exportAll.GET, { path: "/api/export" });
    expect(r.json.gp.feelings.map((f) => f.what)).toContain("WORDS-HEADACHE-S");
    expect(r.json.gp.appointment.medicines).toBe("WORDS-MEDICINE-S");
    expect(r.text).not.toContain("enc:v1:");
  });
});

describe("family sharing is off", () => {
  test("someone in the same old family cannot view the other, even with everything switched on", async () => {
    asUser(T);
    const r = await call(dashboard.GET, { path: `/api/dashboard?d=${d}&viewing=${S.id}` });
    expect(r.status).toBe(200);
    expect(r.text).not.toContain("WORDS-");
    expect(r.text).not.toContain(S.id);
  });

  test("the family pages and routes are gone; the private-space route stays", async () => {
    const visit = (path) => middleware(new NextRequest(new URL(path, "http://localhost:3000")));
    for (const p of ["/api/family", "/api/family/chat", "/api/family/views", "/api/invites", "/api/invites/abc/accept"]) {
      const res = await visit(p);
      expect(res?.status, p).toBe(404);
    }
    expect((await visit("/dashboard/family")).headers.get("location")).toBe("http://localhost:3000/dashboard");
    expect((await visit("/join/abc")).headers.get("location")).toBe("http://localhost:3000/dashboard");
    expect((await visit("/demo/chat")).headers.get("location")).toBe("http://localhost:3000/demo");
    expect(await visit("/api/family/create")).toBeUndefined();
  });

  test("a new person gets a private space of their own without naming a family", async () => {
    await db.insert(USERS).values({ id: NEW.id, email: NEW.email, healthConsentAt: new Date() }).onConflictDoNothing();
    asUser(NEW);
    const r = await call(familyCreate.POST, { method: "POST" });
    expect(r.status, r.text).toBe(200);
    const m = await raw.query("select f.name, f.owner_user_id, (select count(*) from memberships where family_id = f.id)::text as members from families f where f.id = $1", [r.json.familyId]);
    expect(m.rows[0]).toMatchObject({ name: "My space", owner_user_id: NEW.id, members: "1" });
  });
});
