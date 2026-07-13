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
  refreshSubpageTitles,
} from "@/lib/documents/service";
import { getSlackStatus } from "@/lib/slack/status";
import {
  canEdit as accessCanEdit,
  canManageWikiLock,
} from "@/lib/documents/access";
import { Lock } from "lucide-react";
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

  const [ancestors, favorited, workspaces, slack, contentJson] =
    await Promise.all([
      getDocumentAncestors(doc.id),
      isFavorited(session.user.id, doc.id),
      listUserWorkspaces(session.user.id),
      getSlackStatus(doc.workspaceId),
      refreshSubpageTitles(doc.contentJson),
    ]);
  await recordDocumentView(session.user.id, doc.id);

  const workspace = workspaces.find((w) => w.id === doc.workspaceId);
  if (!workspace) notFound();

  const editable = accessCanEdit(result.access);
  const trashed = doc.archivedAt !== null;
  const locked = doc.lockedAt !== null;
  const manageLock =
    doc.docType === "wiki" &&
    canManageWikiLock({
      membershipRole: workspace.role,
      platformRole: result.platformRole,
    });

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
            docType: doc.docType,
            locked,
          }}
          canManageLock={manageLock}
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

      {!trashed && doc.docType === "wiki" && locked && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--hero-wash)] px-3 py-2 text-sm text-[var(--primary)]">
          <Lock className="h-4 w-4 shrink-0" />
          {editable
            ? "This wiki is locked — you can edit it because you're an admin."
            : "This wiki is locked. Only admins can make changes."}
        </div>
      )}

      <DocumentEditorClient
        documentId={doc.id}
        workspaceId={doc.workspaceId}
        initialTitle={doc.title}
        initialContent={contentJson}
        readOnly={!editable || trashed}
      />
    </div>
  );
}
