// Pretend sign-in: each test chooses who is signed in with asUser(). Everything else is the real code.
import { vi } from "vitest";

vi.mock("@kinde-oss/kinde-auth-nextjs/server", () => ({
  getKindeServerSession: () => ({
    isAuthenticated: async () => !!globalThis.__testUser,
    getUser: async () => (globalThis.__testUser ? { id: globalThis.__testUser.id, email: globalThis.__testUser.email, given_name: globalThis.__testUser.name } : null),
    getIdToken: async () => (globalThis.__testUser ? { email: globalThis.__testUser.email, email_verified: globalThis.__testUser.verified !== false } : null),
  }),
}));
