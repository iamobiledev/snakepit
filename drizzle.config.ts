import { defineConfig } from "drizzle-kit";
import "dotenv/config";

/**
 * Drizzle Kit configuration.
 * Migrations should use DATABASE_URL_UNPOOLED (direct) when available.
 * Never run destructive migrations automatically on every Vercel deploy.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "postgresql://user:pass@localhost:5432/docloom",
  },
  verbose: true,
  strict: true,
});
