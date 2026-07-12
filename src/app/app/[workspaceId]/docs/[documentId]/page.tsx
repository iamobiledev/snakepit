import { notFound } from "next/navigation";
import Link from "next/link";
import { FileQuestion, Trash2 } from "lucide-react";
import { requireVerifiedSession } from "@/lib/session";
import {
  getDocumentWithAccess,
  getDocumentAncestors,
  isFavorited,
  recordDocumentView,
  listUserWorkspaces,
} from "@/lib/documents/service";
import { getSlackStatus } from "@/lib/slack/status";
import { canEdit as accessCanEdit } from "@/lib/documents/access";
import { DocumentEditorClient } from "./editor-client";
import { DocHeader } from "@/components/documents/doc-header";
import { RequestAccess } from "@/components/documents/request-access";
import { RestoreBanner } from "@/components/documents/restore-banner";
import { Button } from "@/components/ui/button";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ workspaceId: string; documentId: string }>;
}) {
  const { workspaceId, documentId } = await params;
  const session = await requireVerifiedSession();
  const result = await getDocumentWithAccess(session.user.id, documentId);

  if (!result) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
        <FileQuestion className="h-10 w-10 text-[var(--muted-foreground)]" />
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold">
          This page doesn’t exist
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          It may have been permanently removed, or the link is wrong.
        </p>
        <Button asChild className="mt-6">
          <Link href="/app">Back to your workspaces</Link>
        </Button>
      </div>
    );
  }

  if (result.access === "none") {
    return <RequestAccess documentId={documentId} />;
  }

  const { doc } = result;
  if (doc.workspaceId !== workspaceId) notFound();

  const [ancestors, favorited, workspaces, slack] = await Promise.all([
    getDocumentAncestors(doc.id),
    isFavorited(session.user.id, doc.id),
    listUserWorkspaces(session.user.id),
    getSlackStatus(doc.workspaceId),
  ]);
  await recordDocumentView(session.user.id, doc.id);

  const workspace = workspaces.find((w) => w.id === doc.workspaceId);
  if (!workspace) notFound();

  const editable = accessCanEdit(result.access);
  const trashed = doc.archivedAt !== null;

  return (
    <div className="mx-auto max-w-3xl">
      {trashed ? (
        <RestoreBanner documentId={doc.id} workspaceId={doc.workspaceId} />
      ) : (
        <DocHeader
          doc={{
            id: doc.id,
            workspaceId: doc.workspaceId,
            title: doc.title,
            visibility: doc.visibility,
            publicSlug: doc.publicSlug,
          }}
          workspace={{
            id: workspace.id,
            name: workspace.name,
            isPersonal: workspace.isPersonal,
            role: workspace.role,
          }}
          ancestors={ancestors}
          favorited={favorited}
          canEdit={editable}
          slack={slack}
        />
      )}

      {trashed && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Trash2 className="h-4 w-4" />
          This page is in the trash and is read-only.
        </div>
      )}

      <DocumentEditorClient
        documentId={doc.id}
        workspaceId={doc.workspaceId}
        initialTitle={doc.title}
        initialContent={doc.contentJson}
        readOnly={!editable || trashed}
      />
    </div>
  );
}
