import Link from "next/link";
import { notFound } from "next/navigation";
import { requireVerifiedSession } from "@/lib/session";
import {
  getRecentDocuments,
  listWorkspaceDocuments,
  listUserWorkspaces,
} from "@/lib/documents/service";
import { actionCreateDocument } from "@/app/actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/search/search-box";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await requireVerifiedSession();
  const workspaces = await listUserWorkspaces(session.user.id);
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) notFound();

  const [docs, recent] = await Promise.all([
    listWorkspaceDocuments(session.user.id, workspaceId),
    getRecentDocuments(session.user.id, workspaceId),
  ]);

  async function createDoc() {
    "use server";
    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("title", "Untitled");
    const doc = await actionCreateDocument(formData);
    redirect(`/app/${workspaceId}/docs/${doc.id}`);
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {docs.length} documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/app/${workspaceId}/settings`}>Settings</Link>
          </Button>
          <form action={createDoc}>
            <Button type="submit">New document</Button>
          </form>
        </div>
      </div>

      <div className="md:hidden">
        <SearchBox workspaceId={workspaceId} />
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Recently updated
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {recent.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/app/${workspaceId}/docs/${doc.id}`}
                className="block rounded-md border border-transparent px-3 py-2 hover:border-[var(--border)] hover:bg-[var(--card)]"
              >
                <div className="font-medium">{doc.title}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {doc.updatedAt.toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          All documents
        </h2>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {docs.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/app/${workspaceId}/docs/${doc.id}`}
                className="flex items-center justify-between py-3 hover:text-[var(--primary)]"
              >
                <span>{doc.title}</span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {doc.visibility}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
