import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Check your email">
      <p className="mt-3 text-[var(--muted-foreground)]">
        We sent a verification link. Open it to activate your account, then sign
        in.
      </p>
      <Button asChild className="mt-8">
        <Link href="/sign-in">Back to sign in</Link>
      </Button>
    </AuthShell>
  );
}
