// Helpers for the privacy tests: sign in as someone, call a real route handler, and seed a small world.
import { NextRequest } from "next/server";
import { db } from "@/utils/dbConfig";
import { USERS, FAMILIES, MEMBERSHIPS, PLANS, PLAN_DAYS } from "@/utils/schema";

export function asUser(u) { globalThis.__testUser = u; }

/** Calls an exported route handler the way Next would, and returns { status, text, json }. */
export async function call(handler, { method = "GET", path = "/api/x", body, params = {} } = {}) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"), {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { "content-type": "application/json" },
  });
  const res = await handler(req, { params });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json };
}

export const today = () => new Date().toISOString().slice(0, 10);
const tag = Math.random().toString(36).slice(2, 8);

/** People: A and A2 share a family; B is a stranger in another family; U has an unverified email. */
export const PEOPLE = {
  A: { id: `kp_a_${tag}`, email: `a_${tag}@example.org`, name: "Ada" },
  A2: { id: `kp_a2_${tag}`, email: `a2_${tag}@example.org`, name: "Ade" },
  B: { id: `kp_b_${tag}`, email: `b_${tag}@example.org`, name: "Bola" },
  U: { id: `kp_u_${tag}`, email: `u_${tag}@example.org`, name: "Uche", verified: false },
  N: { id: `kp_n_${tag}`, email: `n_${tag}@example.org`, name: "Nia" },
};
export const FAMILY_A = `fam_a_${tag}`;
export const FAMILY_B = `fam_b_${tag}`;
export const FAMILY_N = `fam_n_${tag}`;

export async function seedWorld({ visibilityA = null } = {}) {
  const { A, A2, B } = PEOPLE;
  await db.insert(USERS).values([
    { id: A.id, email: A.email, displayName: "Ada", visibility: visibilityA, healthConsentAt: new Date() },
    { id: A2.id, email: A2.email, displayName: "Ade", healthConsentAt: new Date() },
    { id: B.id, email: B.email, displayName: "Bola", healthConsentAt: new Date() },
  ]).onConflictDoNothing();
  await db.insert(FAMILIES).values([
    { id: FAMILY_A, name: "Family A", ownerUserId: A.id },
    { id: FAMILY_B, name: "Family B", ownerUserId: B.id },
  ]).onConflictDoNothing();
  await db.insert(MEMBERSHIPS).values([
    { userId: A.id, familyId: FAMILY_A, role: "owner" },
    { userId: A2.id, familyId: FAMILY_A, role: "member" },
    { userId: B.id, familyId: FAMILY_B, role: "owner" },
  ]).onConflictDoNothing();
  const [plan] = await db.insert(PLANS).values({ userId: A.id, familyId: FAMILY_A, name: "A plan" }).returning();
  const [day] = await db.insert(PLAN_DAYS).values({ planId: plan.id, userId: A.id, familyId: FAMILY_A, dayIndex: 0, label: "SECRET-PLANDAY-A" }).returning();
  return { planDayId: day.id };
}

/** Things only A wrote. None of them may ever reach anyone else. */
export const SECRETS = ["SECRET-SLEEP-A", "SECRET-MOOD-A", "SECRET-MEAL-A", "SECRET-BODY-A", "SECRET-CARDIO-A", "SECRET-JOURNAL-A", "SECRET-PLANDAY-A"];
