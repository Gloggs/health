// Privacy tests: the real API route handlers, a real Postgres, and two or more pretend signed-in people.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(".") } },
  test: {
    include: ["tests/privacy/**/*.test.mjs"],
    environment: "node",
    globalSetup: ["tests/privacy/global-setup.mjs"],
    setupFiles: ["tests/privacy/setup.mjs"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: "postgres://postgres:postgres@db.local:5432/health_test",
      NEON_LOCAL_SQL_URL: "http://127.0.0.1:4447/sql",
      KINDE_CLIENT_ID: "test", KINDE_CLIENT_SECRET: "test", KINDE_ISSUER_URL: "https://example.kinde.com",
      KINDE_SITE_URL: "http://localhost:3000", APP_URL: "http://localhost:3000",
      // A test-only key (32 zero bytes). Real deployments use their own random key: see .env.example.
      HEALTH_DATA_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    },
  },
});
