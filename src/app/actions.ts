"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVerifiedSession } from "@/lib/session";
import {
  createDocument,
  saveDocumentContent,
  publishDocument,
} from "@/lib/documents/service";
import {
  createWorkspace,
  inviteToWorkspace,
  acceptInvitation,
} from "@/lib/workspaces/service";
import { getSearchService } from "@/lib/search";
import { uploadWorkspaceFile } from "@/lib/blob/upload";

export async function actionCreateWorkspace(formData: FormData) {
  const session = await requireVerifiedSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  const workspace = await createWorkspace({
    userId: session.user.id,
    name,
  });
  revalidatePath("/app");
  return workspace;
}

export async function actionCreateDocument(formData: FormData) {
  const session = await requireVerifiedSession();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parentId = String(formData.get("parentId") ?? "") || null;
  const title = String(formData.get("title") ?? "Untitled");
  if (!workspaceId) throw new Error("workspaceId is required");

  const doc = await createDocument({
    userId: session.user.id,
    workspaceId,
    parentId,
    title,
  });
  revalidatePath(`/app/${workspaceId}`);
  return doc;
}

export async function actionSaveDocument(input: {
  documentId: string;
  title: string;
  contentJson: Record<string, unknown>;
}) {
  const session = await requireVerifiedSession();
  const parsed = z
    .object({
      documentId: z.string().min(1),
      title: z.string().min(1).max(500),
      contentJson: z.record(z.string(), z.unknown()),
    })
    .parse(input);

  const doc = await saveDocumentContent({
    userId: session.user.id,
    documentId: parsed.documentId,
    title: parsed.title,
    contentJson: parsed.contentJson,
  });
  return { id: doc.id, updatedAt: doc.updatedAt };
}

export async function actionPublishDocument(formData: FormData) {
  const session = await requireVerifiedSession();
  const documentId = String(formData.get("documentId") ?? "");
  const publish = String(formData.get("publish") ?? "true") === "true";
  const doc = await publishDocument({
    userId: session.user.id,
    documentId,
    publish,
  });
  revalidatePath(`/app/${doc.workspaceId}/docs/${doc.id}`);
  return doc;
}

export async function actionInviteMember(formData: FormData) {
  const session = await requireVerifiedSession();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const email = String(formData.get("email") ?? "");
  const role = String(formData.get("role") ?? "member") as
    | "admin"
    | "member"
    | "guest";
  await inviteToWorkspace({
    userId: session.user.id,
    workspaceId,
    email,
    role,
  });
  revalidatePath(`/app/${workspaceId}/settings`);
}

export async function actionAcceptInvitation(token: string) {
  const session = await requireVerifiedSession();
  const workspaceId = await acceptInvitation({
    userId: session.user.id,
    userEmail: session.user.email,
    token,
  });
  revalidatePath("/app");
  return workspaceId;
}

export async function actionSearch(query: string, workspaceId?: string) {
  const session = await requireVerifiedSession();
  const search = getSearchService();
  return search.search({
    query,
    userId: session.user.id,
    workspaceId,
    limit: 20,
  });
}

export async function actionUploadImage(formData: FormData) {
  const session = await requireVerifiedSession();
  const file = formData.get("file");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const documentId = String(formData.get("documentId") ?? "") || undefined;
  if (!(file instanceof File)) throw new Error("file is required");
  if (!workspaceId) throw new Error("workspaceId is required");

  const record = await uploadWorkspaceFile({
    file,
    userId: session.user.id,
    workspaceId,
    documentId,
    kind: "document-image",
    access: "workspace",
  });
  return { url: record.blobUrl, id: record.id };
}
