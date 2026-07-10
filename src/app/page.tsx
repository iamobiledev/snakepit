import Link from "next/link";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%230f5c4c%22 fill-opacity=%220.04%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 animate-fade">
        <div className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--primary)]">
          {brand.logoText}
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-24 pt-10">
        <p className="animate-rise font-[family-name:var(--font-display)] text-6xl font-semibold leading-[1.05] tracking-tight text-[var(--primary)] md:text-8xl">
          {brand.name}
        </p>
        <h1 className="animate-rise animate-delay-1 mt-6 max-w-2xl text-2xl font-medium leading-snug text-[var(--foreground)] md:text-3xl">
          {brand.tagline}
        </h1>
        <p className="animate-rise animate-delay-2 mt-4 max-w-xl text-base text-[var(--muted-foreground)] md:text-lg">
          Capture decisions, share playbooks, and find answers across your
          workspace — with search that respects permissions.
        </p>
        <div className="animate-rise animate-delay-2 mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Start organizing</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
