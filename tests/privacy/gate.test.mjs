// The page gate: nobody reaches the app's screens before they have a space, a name and the health data agreement.
import { test, expect } from "vitest";
import { NextRequest } from "next/server";
import { asUser } from "./harness.mjs";
import { middleware } from "@/middleware.js";
import { db } from "@/utils/dbConfig";
import { USERS, FAMILIES, MEMBERSHIPS } from "@/utils/schema";

const tag = Math.random().toString(36).slice(2, 8);
const P = { id: `kp_g_${tag}`, email: `g_${tag}@example.org`, name: "Gift" };

async function visit(path) {
  const res = await middleware(new NextRequest(new URL(path, "http://localhost:3000")));
  return res?.headers?.get("location") ?? null;
}

test("someone with a space and a name, but no agreement, is sent to onboarding; after agreeing they reach Today", async () => {
  await db.insert(USERS).values({ id: P.id, email: P.email, displayName: "Gift", visibility: {} }).onConflictDoNothing();
  await db.insert(FAMILIES).values({ id: `fam_g_${tag}`, name: "G", ownerUserId: P.id }).onConflictDoNothing();
  await db.insert(MEMBERSHIPS).values({ userId: P.id, familyId: `fam_g_${tag}`, role: "owner" }).onConflictDoNothing();
  asUser(P);
  expect(await visit("/dashboard")).toMatch(/\/onboarding$/);
  expect(await visit("/dashboard/log")).toMatch(/\/onboarding$/);

  const { eq } = await import("drizzle-orm");
  await db.update(USERS).set({ healthConsentAt: new Date() }).where(eq(USERS.id, P.id));
  expect(await visit("/dashboard")).toBeNull();
});
