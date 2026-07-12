import { requireVerifiedSession } from "@/lib/session";
import {
  listUserWorkspaces,
  listWorkspaceDocumentTree,
  listFavoriteDocuments,
} from "@/lib/documents/service";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await requireVerifiedSession();
  const workspaces = await listUserWorkspaces(session.user.id);
  const workspace = workspaces.find((w) => w.id === workspaceId);

  if (!workspace) {
    // Not a member — render a bare shell. Document pages show the
    // request-access screen; everything else 404s at the page level.
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4">
        <div className="w-full">{children}</div>
      </div>
    );
  }

  const [tree, favoriteDocs] = await Promise.all([
    listWorkspaceDocumentTree(session.user.id, workspaceId),
    listFavoriteDocuments(session.user.id, workspaceId),
  ]);

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      workspace={{
        id: workspace.id,
        name: workspace.name,
        isPersonal: workspace.isPersonal,
        role: workspace.role,
      }}
      workspaces={workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        isPersonal: w.isPersonal,
        role: w.role,
      }))}
      tree={tree}
      favorites={favoriteDocs.map((f) => ({ id: f.id, title: f.title }))}
    >
      {children}
    </AppShell>
  );
}
