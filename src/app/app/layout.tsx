import Link from "next/link";
import { brand } from "@/config/brand";
import { SearchBox } from "@/components/search/search-box";
import { SignOutButtons } from "@/components/auth/sign-out-buttons";
import { requireVerifiedSession } from "@/lib/session";
import { listUserWorkspaces } from "@/lib/documents/service";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireVerifiedSession();
  const workspaces = await listUserWorkspaces(session.user.id);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-0 md:gap-6">
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,transparent)] px-4 py-6 md:block">
        <Link
          href="/app"
          className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--primary)]"
        >
          {brand.name}
        </Link>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {session.user.name}
        </p>

        <nav className="mt-8 space-y-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Workspaces
          </p>
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/app/${ws.id}`}
              className="block rounded-md px-2 py-1.5 text-sm hover:bg-[var(--muted)]"
            >
              {ws.name}
            </Link>
          ))}
          <Link
            href="/app/new"
            className="mt-2 block rounded-md px-2 py-1.5 text-sm text-[var(--primary)] hover:bg-[var(--muted)]"
          >
            + New workspace
          </Link>
        </nav>

        <div className="mt-10">
          <SignOutButtons />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-4 md:px-6">
          <Link
            href="/app"
            className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--primary)] md:hidden"
          >
            {brand.name}
          </Link>
          <SearchBox />
        </header>
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
