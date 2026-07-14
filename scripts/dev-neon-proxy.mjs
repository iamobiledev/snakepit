/**
 * Local development Neon HTTP proxy.
 *
 * The app connects to Postgres exclusively through `@neondatabase/serverless`
 * (`neon()` HTTP driver). That driver does not talk to a normal Postgres TCP
 * port — it POSTs SQL to a Neon "SQL over HTTP" endpoint. For local dev we run
 * this tiny proxy which implements that same HTTP protocol on top of a plain
 * local Postgres (via `pg`).
 *
 * With DATABASE_URL host `db.localtest.me`, the serverless driver's default
 * `fetchEndpoint` resolves to `https://api.localtest.me/sql`, so this proxy
 * listens over HTTPS on port 443 and answers `/sql`.
 *
 * This file is DEV-ONLY tooling and is never imported by the application.
 *
 * Env:
 *   PROXY_PG_URL   Postgres connection string (default local cluster).
 *   PROXY_PORT     HTTPS port (default 443).
 *   PROXY_CERT_DIR Directory for the self-signed cert (default ~/.docloom-dev/certs).
 */
import { createServer } from "node:https";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import pg from "pg";

const { Pool, types } = pg;

const PG_URL =
  process.env.PROXY_PG_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/main";
const PORT = Number(process.env.PROXY_PORT ?? 443);
const CERT_DIR =
  process.env.PROXY_CERT_DIR ?? path.join(homedir(), ".docloom-dev", "certs");
const CERT_PATH = path.join(CERT_DIR, "proxy.crt");
const KEY_PATH = path.join(CERT_DIR, "proxy.key");

/** Return every column value as the raw wire text (or null). The neon client
 * requests `Neon-Raw-Text-Output: true` and parses values itself using the
 * dataTypeID, so the proxy must not pre-parse them. */
const rawTextTypes = { getTypeParser: () => (v) => v };

function ensureCert() {
  if (existsSync(CERT_PATH) && existsSync(KEY_PATH)) return;
  mkdirSync(CERT_DIR, { recursive: true });
  execFileSync(
    "openssl",
    [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", KEY_PATH,
      "-out", CERT_PATH,
      "-days", "3650",
      "-subj", "/CN=api.localtest.me",
      "-addext",
      "subjectAltName=DNS:api.localtest.me,DNS:db.localtest.me,DNS:*.localtest.me,DNS:localhost,IP:127.0.0.1,IP:::1",
    ],
    { stdio: "inherit" },
  );
  console.log(`[dev-neon-proxy] generated self-signed cert at ${CERT_PATH}`);
}

const pool = new Pool({ connectionString: PG_URL, max: 10, types });

async function runOne(client, { query, params }) {
  const res = await client.query({
    text: query,
    values: params ?? [],
    rowMode: "array",
    types: rawTextTypes,
  });
  const fields = (res.fields ?? []).map((f) => ({
    name: f.name,
    dataTypeID: f.dataTypeID,
    tableID: f.tableID,
    columnID: f.columnID,
    dataTypeSize: f.dataTypeSize,
    dataTypeModifier: f.dataTypeModifier,
    format: f.format,
  }));
  return {
    command: res.command,
    rowCount: res.rowCount,
    rowAsArray: true,
    rows: res.rows,
    fields,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

ensureCert();

const server = createServer(
  { cert: readFileSync(CERT_PATH), key: readFileSync(KEY_PATH) },
  async (req, res) => {
    if (!req.url || !req.url.startsWith("/sql")) {
      res.writeHead(404).end("not found");
      return;
    }
    let payload;
    try {
      payload = JSON.parse((await readBody(req)) || "{}");
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "invalid JSON body" }));
      return;
    }

    const client = await pool.connect();
    try {
      let out;
      if (Array.isArray(payload.queries)) {
        const isolation = req.headers["neon-batch-isolation-level"];
        await client.query(
          isolation
            ? `BEGIN ISOLATION LEVEL ${String(isolation).replace(/_/g, " ")}`
            : "BEGIN",
        );
        try {
          const results = [];
          for (const q of payload.queries) results.push(await runOne(client, q));
          await client.query("COMMIT");
          out = { results };
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        }
      } else {
        out = await runOne(client, payload);
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    } catch (err) {
      // Mirror the Neon HTTP error envelope (status 400 + pg error fields).
      const body = {
        message: err.message,
        code: err.code,
        detail: err.detail,
        hint: err.hint,
        position: err.position,
        severity: err.severity,
      };
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    } finally {
      client.release();
    }
  },
);

// Listen on dual-stack so both 127.0.0.1 and ::1 (localtest.me AAAA) work.
server.listen(PORT, () => {
  console.log(
    `[dev-neon-proxy] listening on https://api.localtest.me:${PORT}/sql -> ${PG_URL}`,
  );
});
