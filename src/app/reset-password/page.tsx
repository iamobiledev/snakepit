"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth-client";
import { Suspense } from "react";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const password = String(
          new FormData(e.currentTarget).get("password") ?? "",
        );
        setError(null);
        startTransition(async () => {
          const result = await resetPassword({ newPassword: password, token });
          if (result.error) {
            setError(result.error.message ?? "Reset failed");
            return;
          }
          router.push("/sign-in");
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
        />
      </div>
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending || !token}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="mb-8 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--primary)]"
      >
        {brand.name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <Suspense fallback={<p className="mt-8 text-sm">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
