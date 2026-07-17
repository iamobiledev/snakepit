import type { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actionCreateDocument } from "@/app/actions";

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Create a document via the server action and navigate to it, toasting on
 * failure. Shared by the sidebar and the "New page/wiki" buttons so the
 * FormData shape and post-create navigation stay in sync.
 */
export async function createDocumentAndNavigate(
  router: AppRouter,
  input: {
    workspaceId: string;
    parentId?: string;
    docType?: "doc" | "wiki";
  },
): Promise<void> {
  const formData = new FormData();
  formData.set("workspaceId", input.workspaceId);
  if (input.parentId) formData.set("parentId", input.parentId);
  formData.set("title", "Untitled");
  formData.set("docType", input.docType ?? "doc");

  const result = await actionCreateDocument(formData);
  if (!result.ok) {
    toast.error(result.error);
    return;
  }
  router.push(`/app/${result.data.workspaceId}/docs/${result.data.id}`);
  router.refresh();
}
