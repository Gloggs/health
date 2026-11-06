// A local stand-in for Neon's SQL-over-HTTP endpoint, for tests only (the same idea as in the here app).
// It answers POST /sql with { query, params } or { queries: [...] } as a transaction, returning rows as raw
// text arrays, which is what @neondatabase/serverless expects. The app uses it only when NEON_LOCAL_SQL_URL
// is set, which production never does.
import http from "node:http";
import pg from "pg";
import { pathToFileURL } from "node:url";

export function startNeonLocal({ port = 4447, pgUrl } = {}) {
  const pool = new pg.Pool({ connectionString: pgUrl, types: { getTypeParser: () => (v) => v } });
  const run = async (client, q) => {
    const r = await client.query({ text: q.query, values: q.params || [], rowMode: "array" });
    return { command: r.command, rowCount: r.rowCount, rows: r.rows,
      fields: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID, tableID: f.tableID, columnID: f.columnID,
        dataTypeSize: f.dataTypeSize, dataTypeModifier: f.dataTypeModifier, format: "text" })) };
  };
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST") { res.writeHead(200).end("ok"); return; }
    let body = ""; for await (const c of req) body += c;
    const client = await pool.connect();
    try {
      const j = JSON.parse(body || "{}");
      let out;
      if (Array.isArray(j.queries)) {
        await client.query("BEGIN");
        const results = []; for (const q of j.queries) results.push(await run(client, q));
        await client.query("COMMIT"); out = { results };
      } else out = await run(client, j);
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(out));
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { /* not in a transaction */ }
      res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ message: e.message, code: e.code }));
    } finally { client.release(); }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({
    close: () => new Promise((r) => server.close(() => pool.end().then(r))),
  })));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await startNeonLocal({ port: Number(process.env.NEON_LOCAL_PORT || 4447), pgUrl: process.env.PG_URL });
  console.log("neon-local ready");
}
