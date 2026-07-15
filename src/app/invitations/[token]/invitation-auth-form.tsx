"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  actionRegisterForInvitation,
  actionSignInForInvitation,
} from "@/app/invitations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InvitationAuthForm({
  token,
  email,
  initialMode,
  currentSessionEmail,
  accountVerified,
}: {
  token: string;
  email: string;
  initialMode: "register" | "sign-in";
  currentSessionEmail?: string;
  accountVerified?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const switchingAccounts =
    currentSessionEmail &&
    currentSessionEmail.toLowerCase() !== email.toLowerCase();

  return (
    <div className="mt-8">
      <div className="mb-5">
        <h2 className="text-base font-medium">
          {mode === "register"
            ? "Set up your account"
            : "Sign in to continue"}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {mode === "register"
            ? "Choose a password for future sign-ins. You’ll accept the invitation next."
            : "Use the password for this account. You’ll accept the invitation next."}
        </p>
        {switchingAccounts && (
          <p className="mt-3 rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
            You’re signed in as {currentSessionEmail}. Continuing will switch
            to {email}.
          </p>
        )}
        {mode === "sign-in" && accountVerified === false && (
          <p className="mt-3 text-sm text-[var(--destructive)]">
            This account still needs email verification before it can sign in.
          </p>
        )}
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setError(null);
          startTransition(async () => {
            const result =
              mode === "register"
                ? await actionRegisterForInvitation({
                    token,
                    name: String(form.get("name") ?? ""),
                    password: String(form.get("password") ?? ""),
                    confirmPassword: String(
                      form.get("confirmPassword") ?? "",
                    ),
                  })
                : await actionSignInForInvitation({
                    token,
                    password: String(form.get("password") ?? ""),
                  });

            if (!result.ok) {
              if (result.code === "ACCOUNT_EXISTS") {
                setMode("sign-in");
              }
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="invitation-email">Email</Label>
          <Input
            id="invitation-email"
            value={email}
            readOnly
            autoComplete="email"
            className="bg-[var(--muted)]"
          />
        </div>

        {mode === "register" && (
          <div className="space-y-2">
            <Label htmlFor="invitation-name">Name</Label>
            <Input
              id="invitation-name"
              name="name"
              required
              maxLength={100}
              autoComplete="name"
              autoFocus
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="invitation-password">
            {mode === "register" ? "Create password" : "Password"}
          </Label>
          <Input
            id="invitation-password"
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            maxLength={128}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            autoFocus={mode === "sign-in"}
          />
        </div>

        {mode === "register" && (
          <div className="space-y-2">
            <Label htmlFor="invitation-confirm-password">
              Confirm password
            </Label>
            <Input
              id="invitation-confirm-password"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--destructive)]" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? mode === "register"
              ? "Setting up…"
              : "Signing in…"
            : mode === "register"
              ? "Set password and continue"
              : "Sign in and continue"}
        </Button>
      </form>

      {mode === "sign-in" && (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          <Link href="/forgot-password" className="underline">
            Forgot password?
          </Link>
        </p>
      )}
    </div>
  );
}
