import Link from "next/link";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--primary)]">
        {brand.name}
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        This page is missing or no longer public.
      </p>
      <Button asChild className="mt-8 w-fit">
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
