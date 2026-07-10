import { z } from "zod";

/**
 * Browser-safe environment variables (NEXT_PUBLIC_* only).
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_VERCEL_ENV: z
    .enum(["development", "preview", "production"])
    .optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid client environment variables: ${parsed.error.issues
        .map((i) => i.message)
        .join(", ")}`,
    );
  }

  return parsed.data;
}
