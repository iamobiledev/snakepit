/**
 * Extra Google Workspace domain checks used alongside Better Auth's built-in
 * `hd` enforcement (verifyIdToken + getUserInfo in better-auth ≥1.6.16).
 *
 * Keeping this in our code makes the restriction reviewable and rejects
 * profiles whose email domain does not match GOOGLE_HOSTED_DOMAIN even if a
 * future library change weakens the `hd` claim check.
 *
 * Do NOT replace `getUserInfo` on the Google provider — that would override
 * Better Auth's built-in `hd` claim enforcement. Use `mapProfileToUser`
 * instead (it runs after that check).
 */

/** True when `email` is at exactly `hostedDomain` (case-insensitive). */
export function emailMatchesHostedDomain(
  email: string | null | undefined,
  hostedDomain: string,
): boolean {
  const domain = hostedDomain.trim().toLowerCase();
  if (!domain) return false;
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return false;
  return normalized.slice(at + 1) === domain;
}

/**
 * Throw when a Google profile's email is outside the configured Workspace
 * domain. Used from `socialProviders.google.mapProfileToUser`.
 */
export function assertGoogleEmailMatchesHostedDomain(
  profile: { email?: string | null },
  hostedDomain: string | undefined,
): void {
  if (!hostedDomain) return;
  if (!emailMatchesHostedDomain(profile.email, hostedDomain)) {
    throw new Error("GOOGLE_HOSTED_DOMAIN_MISMATCH");
  }
}
