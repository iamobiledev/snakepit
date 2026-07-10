import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { getServerEnv } from "@/env/server";

/**
 * Neon HTTP + Drizzle connection helper for Vercel Functions.
 * Uses the pooled DATABASE_URL. Do not open unnecessary connections —
 * neon() creates a lightweight HTTP client suitable for serverless.
 */
function createDb() {
  const { DATABASE_URL } = getServerEnv();
  const sql = neon(DATABASE_URL);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __docloomDb?: Database };

/**
 * Reuse the client across hot reloads in development.
 * On Vercel each invocation may get a fresh module scope; neon HTTP
 * does not hold persistent sockets, so this is safe.
 */
export function getDb(): Database {
  if (process.env.NODE_ENV === "production") {
    return createDb();
  }
  if (!globalForDb.__docloomDb) {
    globalForDb.__docloomDb = createDb();
  }
  return globalForDb.__docloomDb;
}

export * from "./schema";
