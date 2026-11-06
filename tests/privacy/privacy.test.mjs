// The privacy promise, tested: nobody sees another person's details unless that person chose to share them.
// A writes private things. B (a stranger in another family) and A2 (in A's family) try to read them.
import { describe, test, expect, beforeAll } from "vitest";
import { asUser, call, seedWorld, PEOPLE, SECRETS, today } from "./harness.mjs";

import * as sleep from "@/app/api/sleep/route.js";
import * as mood from "@/app/api/mood/route.js";
import * as meals from "@/app/api/meals/route.js";
import * as body from "@/app/api/body-metrics/route.js";
import * as cardio from "@/app/api/cardio/route.js";
import * as chat from "@/app/api/chat/route.js";
import * as water from "@/app/api/water/route.js";
import * as dashboard from "@/app/api/dashboard/route.js";
import * as family from "@/app/api/family/route.js";
import * as activity from "@/app/api/family/activity/route.js";
import * as familyChat from "@/app/api/family/chat/route.js";
import * as sessions from "@/app/api/sessions/route.js";
import * as sessionsToday from "@/app/api/sessions/today/route.js";
import * as plans from "@/app/api/plans/route.js";
import * as exportRoute from "@/app/api/export/route.js";
import * as me from "@/app/api/users/me/route.js";
import * as familyCreate from "@/app/api/family/create/route.js";
import * as invites from "@/app/api/invites/route.js";
import * as feelings from "@/app/api/feelings/route.js";
import * as appointment from "@/app/api/appointment/route.js";
import * as summary from "@/app/api/summary/route.js";
import * as fhirExport from "@/app/api/export/fhir/route.js";

const { A, A2, B, U } = PEOPLE;
const d = today();
const WEIGHT = "77.7";
let world;

beforeAll(async () => {
  world = await seedWorld();
  asUser(A);
  const writes = [
    [sleep.POST, { date: d, hours: 7.5, quality: 4, bedtime: "23:00", wakeTime: "06:30", note: "SECRET-SLEEP-A" }],
    [mood.POST, { date: d, mood: 4, energy: 3, note: "SECRET-MOOD-A", tags: ["SECRET-MOOD-A"] }],
    [meals.POST, { date: d, slot: "lunch", quality: 4, description: "SECRET-MEAL-A" }],
    [body.POST, { date: d, weightKg: 77.7, note: "SECRET-BODY-A" }],
    [cardio.POST, { date: d, type: "walk", durationMinutes: 20, note: "SECRET-CARDIO-A" }],
    [chat.POST, { date: d, content: "SECRET-JOURNAL-A" }],
    [water.POST, { date: d, amountMl: 500 }],
    [appointment.PUT, { date: d, questions: "SECRET-FEELING-A question", medicines: "SECRET-FEELING-A medicine" }],
    [feelings.POST, { date: d, what: "SECRET-FEELING-A", howBad: "moderate", better: "SECRET-FEELING-A", note: "SECRET-FEELING-A" }],
  ];
  for (const [handler, payload] of writes) {
    const r = await call(handler, { method: "POST", path: "/api/x", body: payload });
    expect(r.status, `A's write failed: ${r.text}`).toBeLessThan(300);
  }
});

const READS = [
  ["sleep", sleep], ["mood", mood], ["meals", meals], ["body-metrics", body], ["cardio", cardio], ["chat", chat],
  ["water", water], ["dashboard", dashboard], ["family", family], ["family/activity", activity], ["family/chat", familyChat],
  ["feelings", feelings], ["appointment", appointment], ["export/fhir", fhirExport], ["sessions", sessions], ["sessions/today", sessionsToday], ["plans", plans], ["export", exportRoute], ["users/me", me],
];

function leaks(text, { weight = true } = {}) {
  const found = SECRETS.filter((s) => text.includes(s));
  if (weight && text.includes(WEIGHT)) found.push(`weight ${WEIGHT}`);
  return found;
}

describe("a stranger in another family sees nothing of A", () => {
  for (const [name, mod] of READS) {
    test(`${name}, asked for directly and with ?viewing=A`, async () => {
      asUser(B);
      for (const q of [`?date=${d}`, `?date=${d}&viewing=${A.id}`, `?viewing=${A.id}&from=2000-01-01&to=2100-01-01`]) {
        const r = await call(mod.GET, { path: `/api/${name}${q}` });
        expect(leaks(r.text), `${name}${q}`).toEqual([]);
      }
    });
  }

  test("pointing a session at A's training day does not reveal its name", async () => {
    asUser(B);
    await call(sessions.POST, { method: "POST", body: { date: d, planDayId: world.planDayId, completed: true } });
    for (const mod of [sessions, sessionsToday, dashboard]) {
      const r = await call(mod.GET, { path: `/api/x?date=${d}` });
      expect(leaks(r.text)).toEqual([]);
    }
  });
});

describe("a family member sees only what A switched on, and never a note", () => {
  test("with no choices made, nothing of A's health data is shared", async () => {
    asUser(A2);
    const r = await call(dashboard.GET, { path: `/api/dashboard?date=${d}&viewing=${A.id}` });
    expect(r.status).toBe(200);
    expect(leaks(r.text)).toEqual([]);
  });

  test("with everything switched on, the numbers show but notes never do", async () => {
    asUser(A);
    await call(me.PUT ?? me.PATCH ?? me.POST, { method: me.PUT ? "PUT" : me.PATCH ? "PATCH" : "POST", body: { visibility: { body: true, sleep: true, mood: true, meals: true, cardio: true, workouts: true, age: true, height: true } } });
    asUser(A2);
    const r = await call(dashboard.GET, { path: `/api/dashboard?date=${d}&viewing=${A.id}` });
    expect(r.status).toBe(200);
    expect(leaks(r.text, { weight: false })).toEqual([]);
  });
});

describe("opening sign-up safely", () => {
  test("an account whose email is not verified cannot create a family", async () => {
    asUser(U);
    const r = await call(familyCreate.POST, { method: "POST", body: { name: "Unverified family" } });
    expect(r.status).toBe(403);
  });

  test("a family cannot send unlimited invites", async () => {
    asUser(B);
    const statuses = [];
    for (let i = 0; i < 25; i++) {
      const r = await call(invites.POST, { method: "POST", body: { email: `invitee${i}_${Date.now()}@example.org` } });
      statuses.push(r.status);
    }
    expect(statuses).toContain(429);
  });
});

describe("the family page and feed follow the same switches", () => {
  test("with nothing switched on, A's streak, counts and activity are not shown to the family", async () => {
    asUser(A);
    await call(me.PUT, { method: "PUT", body: { visibility: {} } });
    asUser(A2);
    const fam = await call(family.GET, { path: `/api/family?date=${d}` });
    const a = fam.json.members.find((m) => m.id === A.id);
    expect(a).toBeTruthy();
    for (const k of ["streak", "completedWorkoutsThisWeek", "dailyMiniTodayTotal", "etchedToday", "etchedTodayCount", "last7DaysTally", "age", "heightCm"]) {
      expect(a[k], k).toBeNull();
    }
    const feed = await call(activity.GET, { path: `/api/family/activity?date=${d}` });
    expect(feed.json.items.filter((i) => i.userId === A.id)).toEqual([]);
  });

  test("the journal is never shared, even with everything switched on", async () => {
    asUser(A);
    await call(me.PUT, { method: "PUT", body: { visibility: { body: true, sleep: true, mood: true, meals: true, cardio: true, workouts: true, water: true, daily4: true, streak: true } } });
    asUser(A2);
    for (const mod of [chat, dashboard, familyChat, activity, family, exportRoute, feelings]) {
      const r = await call(mod.GET, { path: `/api/x?date=${d}&viewing=${A.id}` });
      expect(r.text.includes("SECRET-JOURNAL-A")).toBe(false);
      expect(r.text.includes("SECRET-FEELING-A")).toBe(false);
    }
  });
});

describe("small checks", () => {
  test("recording a profile view only works for someone in your own family", async () => {
    const views = await import("@/app/api/family/views/route.js");
    asUser(B);
    const r = await call(views.POST, { method: "POST", body: { vieweeId: A.id } });
    expect(r.status).toBe(404);
  });

  test("a database or library error never reaches the browser as raw text", async () => {
    const { safeMessage } = await import("@/lib/auth.js");
    expect(safeMessage(new Error('relation "users" does not exist'))).toBe("Something went wrong. Please try again.");
    expect(safeMessage(Object.assign(new Error("email is required"), { status: 400 }))).toBe("email is required");
  });
});

describe("how I feel", () => {
  test("the person sees their own entries; the app keeps their words and adds no judgement", async () => {
    asUser(A);
    const r = await call(feelings.GET, { path: "/api/feelings" });
    const mine = r.json.find((f) => f.what === "SECRET-FEELING-A");
    expect(mine).toBeTruthy();
    expect(mine.howBad).toBe("moderate");
    expect(Object.keys(mine).some((k) => /score|risk|advice|diagnos/i.test(k))).toBe(false);
  });

  test("a made-up severity is refused, and nobody can change or delete someone else's entry", async () => {
    asUser(A);
    const bad = await call(feelings.POST, { method: "POST", body: { date: d, what: "Cough", howBad: "9 out of 10" } });
    expect(bad.status).toBe(400);
    const list = await call(feelings.GET, { path: "/api/feelings" });
    const id = list.json[0].id;
    asUser(B);
    const edit = await call(feelings.PUT, { method: "PUT", body: { id, date: d, what: "changed by B" } });
    expect(edit.status).toBe(404);
    const del = await call(feelings.DELETE, { method: "DELETE", path: `/api/feelings?id=${id}` });
    expect(del.status).toBe(404);
  });
});

describe("the GP summary", () => {
  test("A gets their own summary, with their words, appointment questions and medicines", async () => {
    asUser(A);
    const r = await call(summary.GET, { path: "/api/summary" });
    expect(r.status).toBe(200);
    expect(r.json.happening.some((h) => h.what === "SECRET-FEELING-A")).toBe(true);
    expect(r.json.questions).toContain("SECRET-FEELING-A question");
    expect(r.json.footer).toMatch(/Your GP decides what this means/);
  });

  test("nobody else can get A's summary: not a stranger, not family, not by asking for A", async () => {
    for (const who of [B, A2]) {
      asUser(who);
      const own = await call(summary.GET, { path: "/api/summary" });
      expect(own.text.includes("SECRET-FEELING-A")).toBe(false);
      const asked = await call(summary.GET, { path: `/api/summary?viewing=${A.id}` });
      expect(asked.text.includes("SECRET-FEELING-A")).toBe(false);
    }
  });
});

describe("the FHIR export", () => {
  test("A's export holds A's own entries as FHIR, and no email", async () => {
    asUser(A);
    const r = await call(fhirExport.GET, { path: "/api/export/fhir" });
    expect(r.status).toBe(200);
    expect(r.json.resourceType).toBe("Bundle");
    expect(r.text.includes("SECRET-FEELING-A")).toBe(true);
    expect(r.text.includes(A.email)).toBe(false);
  });
});

describe("health data needs the person's agreement first", () => {
  test("nothing can be saved, and no family started, until the person agrees; then it works", async () => {
    const { db } = await import("@/utils/dbConfig");
    const { USERS, FAMILIES, MEMBERSHIPS } = await import("@/utils/schema");
    const { PEOPLE: P, FAMILY_N } = await import("./harness.mjs");
    const N = P.N;
    await db.insert(USERS).values({ id: N.id, email: N.email, displayName: "Nia" }).onConflictDoNothing();
    asUser(N);
    const create = await call(familyCreate.POST, { method: "POST", body: { name: "Nia's family" } });
    expect(create.status).toBe(403);

    await db.insert(FAMILIES).values({ id: FAMILY_N, name: "N", ownerUserId: N.id }).onConflictDoNothing();
    await db.insert(MEMBERSHIPS).values({ userId: N.id, familyId: FAMILY_N, role: "owner" }).onConflictDoNothing();
    const before = await call(sleep.POST, { method: "POST", body: { date: d, hours: 7, quality: 3 } });
    expect(before.status).toBe(403);

    const agreed = await call(me.PUT, { method: "PUT", body: { healthConsent: true } });
    expect(agreed.status).toBe(200);
    expect(agreed.json.healthConsentAt).toBeTruthy();
    const after = await call(sleep.POST, { method: "POST", body: { date: d, hours: 7, quality: 3 } });
    expect(after.status).toBeLessThan(300);
  });
});
