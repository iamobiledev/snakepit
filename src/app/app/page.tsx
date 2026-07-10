import Link from "next/link";
import { redirect } from "next/navigation";
import { requireVerifiedSession } from "@/lib/session";
import { listUserWorkspaces } from "@/lib/documents/service";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";

export default async function AppHomePage() {
  const session = await requireVerifiedSession();
  const workspaces = await listUserWorkspaces(session.user.id);

  if (workspaces.length === 1) {
    redirect(`/app/${workspaces[0].id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        Your workspaces
      </h1>
      <p className="mt-2 text-[var(--muted-foreground)]">{brand.tagline}</p>

      <ul className="mt-8 space-y-3">
        {workspaces.map((ws) => (
          <li key={ws.id}>
            <Link
              href={`/app/${ws.id}`}
              className="block rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-3 hover:border-[var(--primary)]"
            >
              <div className="font-medium">{ws.name}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Role: {ws.role}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {workspaces.length === 0 && (
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          No workspaces yet. Create one to get started.
        </p>
      )}

      <Button asChild className="mt-8">
        <Link href="/app/new">Create workspace</Link>
      </Button>
    </div>
  );
}
