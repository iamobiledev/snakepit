import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { shouldUsePgDriver } from "../src/db/create-db";
import { redactDatabaseUrls } from "../src/db/schema-readiness";
import {
  inspectConfiguredSchemaTargets,
  schemaDiagnosticMessage,
} from "./schema-readiness";

/**
 * Production-safe migration runner.
 * Uses DATABASE_URL_UNPOOLED when set (direct connection recommended for DDL).
 * Local/loopback URLs automatically use the node-postgres driver.
 *
 * Never invoked automatically by Vercel builds — run intentionally:
 *   pnpm db:migrate
 */
async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL or DATABASE_URL_UNPOOLED is required to run migrations",
    );
  }

  console.log("Applying database migrations to the migration target…");
  if (shouldUsePgDriver(url)) {
    const pool = new Pool({ connectionString: url });
    try {
      const db = drizzlePg(pool);
      await migratePg(db, { migrationsFolder: "./drizzle" });
    } finally {
      await pool.end();
    }
  } else {
    const sql = neon(url);
    const db = drizzleNeon(sql);
    await migrateNeon(db, { migrationsFolder: "./drizzle" });
  }

  console.log(
    "DDL migrations applied. Verifying every configured database target…",
  );
  const report = await inspectConfiguredSchemaTargets(process.env);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) {
    throw new Error(schemaDiagnosticMessage(report.diagnostic));
  }
  console.log("Migrations complete; runtime schema verification passed.");
}

main().catch((err) => {
  const configuredUrls = [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
  ].filter((url): url is string => Boolean(url));
  const message = err instanceof Error ? err.message : String(err);
  console.error(redactDatabaseUrls(message, configuredUrls));
  process.exit(1);
});
