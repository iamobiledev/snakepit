"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;

export async function requestPasswordReset(opts: {
  email: string;
  redirectTo?: string;
}) {
  return authClient.requestPasswordReset({
    email: opts.email,
    redirectTo: opts.redirectTo,
  });
}

export async function resetPassword(opts: {
  newPassword: string;
  token: string;
}) {
  return authClient.resetPassword({
    newPassword: opts.newPassword,
    token: opts.token,
  });
}
