import "server-only";
import { z } from "zod";

/**
 * Server-only environment variables.
 * Never import this module from Client Components.
 *
 * Set SKIP_ENV_VALIDATION=1 for lint/typecheck without a full .env.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Pooled Neon connection string (use for app queries on Vercel) */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Direct / unpooled Neon connection (use for migrations) */
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),

  /** Better Auth secret — generate with `openssl rand -base64 32` */
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be ≥32 chars"),
  /** Canonical application URL (no trailing slash) */
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  /** Resend (or compatible) transactional email */
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),

  /** Vercel Blob read/write token */
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),

  /** Protects Vercel Cron route handlers */
  CRON_SECRET: z.string().min(1).optional(),

  /** Optional: document Neon primary region */
  NEON_REGION: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(
      (issue) =>
        `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    )
    .join("\n");
}

let cached: ServerEnv | null = null;

/**
 * Validates and returns server environment variables.
 * Fails fast with a clear message when required vars are missing.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.SKIP_ENV_VALIDATION === "1" || isNextBuild) {
    cached = {
      NODE_ENV:
        (process.env.NODE_ENV as ServerEnv["NODE_ENV"]) ?? "development",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://user:pass@localhost:5432/docloom",
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        "dev-only-secret-skip-validation-32ch",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      NEXT_PUBLIC_APP_URL:
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
      CRON_SECRET: process.env.CRON_SECRET,
      NEON_REGION: process.env.NEON_REGION,
    };
    return cached;
  }

  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined),
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    NEON_REGION: process.env.NEON_REGION,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${formatZodError(parsed.error)}\n\nSee .env.example for the full list.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** App base URL used for auth callbacks, invitations, and public links. */
export function getAppUrl(): string {
  const env = getServerEnv();
  const configured = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/** Connection string for migrations (prefer unpooled / direct). */
export function getMigrationDatabaseUrl(): string {
  const env = getServerEnv();
  return env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
}
