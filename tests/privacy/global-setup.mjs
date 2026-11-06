import { startNeonLocal } from "../../scripts/neon-local.mjs";

export default async function setup() {
  const server = await startNeonLocal({ port: 4447, pgUrl: process.env.PG_URL || "postgres://postgres:postgres@127.0.0.1:6543/health_test" });
  return () => server.close();
}
