import Link from "next/link";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="mb-8 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--primary)]"
      >
        {brand.name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-3 text-[var(--muted-foreground)]">
        We sent a verification link. Open it to activate your account, then sign
        in.
      </p>
      <Button asChild className="mt-8">
        <Link href="/sign-in">Back to sign in</Link>
      </Button>
    </main>
  );
}
