import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";

/**
 * Production-safe migration runner.
 * Uses DATABASE_URL_UNPOOLED when set (direct connection recommended for DDL).
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

  console.log("Running migrations…");
  const sql = neon(url);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
