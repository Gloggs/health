// Browser tests (docs/TESTING.md): the front page and the demo, as a stranger would use them, at phone and laptop sizes.
// The demo runs on sample data in the browser, so no database or sign-in is needed.
import { defineConfig, devices } from "@playwright/test";

const PORT = 3300;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`, url: `http://localhost:${PORT}/`, reuseExistingServer: !process.env.CI, timeout: 120_000,
    env: { DATABASE_URL: "postgresql://e2e:e2e@localhost/e2e", KINDE_CLIENT_ID: "e2e", KINDE_CLIENT_SECRET: "e2e", KINDE_ISSUER_URL: "https://example.kinde.com", KINDE_SITE_URL: `http://localhost:${PORT}` },
  },
});
