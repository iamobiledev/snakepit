import { notFound } from "next/navigation";
import { requireVerifiedSession } from "@/lib/session";
import { getDocumentForUser } from "@/lib/documents/service";
import { DocumentEditorClient } from "./editor-client";
import { actionPublishDocument } from "@/app/actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ workspaceId: string; documentId: string }>;
}) {
  const { workspaceId, documentId } = await params;
  const session = await requireVerifiedSession();
  const doc = await getDocumentForUser(session.user.id, documentId);
  if (!doc || doc.workspaceId !== workspaceId) notFound();

  async function togglePublish(formData: FormData) {
    "use server";
    await actionPublishDocument(formData);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/app/${workspaceId}`}
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back
        </Link>
        <div className="flex items-center gap-2">
          {doc.visibility === "public" && doc.publicSlug && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/p/${doc.publicSlug}`} target="_blank">
                View public page
              </Link>
            </Button>
          )}
          <form action={togglePublish}>
            <input type="hidden" name="documentId" value={doc.id} />
            <input
              type="hidden"
              name="publish"
              value={doc.visibility === "public" ? "false" : "true"}
            />
            <Button type="submit" size="sm" variant="secondary">
              {doc.visibility === "public" ? "Unpublish" : "Publish"}
            </Button>
          </form>
        </div>
      </div>

      <DocumentEditorClient
        documentId={doc.id}
        initialTitle={doc.title}
        initialContent={doc.contentJson}
      />
    </div>
  );
}
