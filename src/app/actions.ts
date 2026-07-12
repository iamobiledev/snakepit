"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVerifiedSession } from "@/lib/session";
import {
  createDocument,
  saveDocumentContent,
  publishDocument,
  trashDocument,
  restoreDocument,
  toggleFavorite,
  moveDocument,
  renameDocument,
  listDocumentVersions,
  getDocumentVersion,
  restoreDocumentVersion,
  getDocumentWithAccess,
} from "@/lib/documents/service";
import {
  createWorkspace,
  inviteToWorkspace,
  acceptInvitation,
  updateMemberRole,
  removeMember,
  renameWorkspace,
  revokeInvitation,
  listWorkspaceMembers,
  getWorkspaceById,
} from "@/lib/workspaces/service";
import { getSearchService } from "@/lib/search";
import { uploadWorkspaceFile } from "@/lib/blob/upload";
import { sendAccessRequestEmail } from "@/lib/email";
import { getAppUrl } from "@/env/server";
import { getDb, workspaceMembers, user as userTable } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "@/lib/logger";

/* -------------------------------------------------------------------------- */
/* Result helpers                                                              */
/* -------------------------------------------------------------------------- */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const FRIENDLY_ERRORS: Record<string, string> = {
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "That item could not be found.",
  INVALID_PARENT: "You can't move a page inside itself or its sub-pages.",
  PERSONAL_WORKSPACE: "Personal notebooks can't be shared.",
  CANNOT_CHANGE_OWNER: "The workspace owner's role can't be changed.",
  CANNOT_REMOVE_OWNER: "The workspace owner can't be removed.",
  INVITATION_INACTIVE: "This invitation is no longer active.",
  INVITATION_EXPIRED: "This invitation has expired.",
  EMAIL_MISMATCH: "This invitation was sent to a different email address.",
};

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (FRIENDLY_ERRORS[message]) return FRIENDLY_ERRORS[message];
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }
  logger.error("action.unexpected_error", { error: message });
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

/* -------------------------------------------------------------------------- */
/* Workspaces                                                                  */
/* -------------------------------------------------------------------------- */

export async function actionCreateWorkspace(formData: FormData) {
  const session = await requireVerifiedSession();
  const name = z
    .string()
    .min(1, "Name is required")
    .max(100)
    .parse(String(formData.get("name") ?? "").trim());
  const workspace = await createWorkspace({ userId: session.user.id, name });
  revalidatePath("/app");
  return workspace;
}

export async function actionRenameWorkspace(input: {
  workspaceId: string;
  name: string;
}): Promise<ActionResult<undefined>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({ workspaceId: z.string().min(1), name: z.string().min(1).max(100) })
      .parse(input);
    await renameWorkspace({ userId: session.user.id, ...parsed });
    revalidatePath(`/app/${parsed.workspaceId}`);
    return undefined;
  });
}

export async function actionInviteMember(input: {
  workspaceId: string;
  email: string;
  role: "admin" | "member" | "guest";
}): Promise<ActionResult<undefined>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({
        workspaceId: z.string().min(1),
        email: z.string().email("Enter a valid email address").max(320),
        role: z.enum(["admin", "member", "guest"]),
      })
      .parse(input);
    await inviteToWorkspace({ userId: session.user.id, ...parsed });
    revalidatePath(`/app/${parsed.workspaceId}/settings`);
    return undefined;
  });
}

export async function actionUpdateMemberRole(input: {
  workspaceId: string;
  targetUserId: string;
  role: "admin" | "member" | "guest";
}): Promise<ActionResult<undefined>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({
        workspaceId: z.string().min(1),
        targetUserId: z.string().min(1),
        role: z.enum(["admin", "member", "guest"]),
      })
      .parse(input);
    await updateMemberRole({ userId: session.user.id, ...parsed });
    revalidatePath(`/app/${parsed.workspaceId}/settings`);
    return undefined;
  });
}

export async function actionRemoveMember(input: {
  workspaceId: string;
  targetUserId: string;
}): Promise<ActionResult<undefined>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({ workspaceId: z.string().min(1), targetUserId: z.string().min(1) })
      .parse(input);
    await removeMember({ userId: session.user.id, ...parsed });
    revalidatePath(`/app/${parsed.workspaceId}/settings`);
    return undefined;
  });
}

export async function actionRevokeInvitation(input: {
  workspaceId: string;
  invitationId: string;
}): Promise<ActionResult<undefined>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({ workspaceId: z.string().min(1), invitationId: z.string().min(1) })
      .parse(input);
    await revokeInvitation({ userId: session.user.id, ...parsed });
    revalidatePath(`/app/${parsed.workspaceId}/settings`);
    return undefined;
  });
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

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

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
}): Promise<ActionResult<{ id: string; updatedAt: string }>> {
  const session = await requireVerifiedSession();
  return run(async () => {
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
    return { id: doc.id, updatedAt: doc.updatedAt.toISOString() };
  });
}

export async function actionRenameDocument(input: {
  documentId: string;
  title: string;
}): Promise<ActionResult<undefined>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({ documentId: z.string().min(1), title: z.string().min(1).max(500) })
      .parse(input);
    const doc = await renameDocument({ userId: session.user.id, ...parsed });
    revalidatePath(`/app/${doc.workspaceId}`);
    return undefined;
  });
}

export async function actionPublishDocument(input: {
  documentId: string;
  publish: boolean;
}): Promise<ActionResult<{ publicSlug: string | null; visibility: string }>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({ documentId: z.string().min(1), publish: z.boolean() })
      .parse(input);
    const doc = await publishDocument({ userId: session.user.id, ...parsed });
    revalidatePath(`/app/${doc.workspaceId}/docs/${doc.id}`);
    return { publicSlug: doc.publicSlug, visibility: doc.visibility };
  });
}

export async function actionTrashDocument(input: {
  documentId: string;
}): Promise<ActionResult<{ workspaceId: string }>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z.object({ documentId: z.string().min(1) }).parse(input);
    const doc = await trashDocument({
      userId: session.user.id,
      documentId: parsed.documentId,
    });
    revalidatePath(`/app/${doc.workspaceId}`);
    return { workspaceId: doc.workspaceId };
  });
}

export async function actionRestoreDocument(input: {
  documentId: string;
}): Promise<ActionResult<{ workspaceId: string }>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z.object({ documentId: z.string().min(1) }).parse(input);
    const doc = await restoreDocument({
      userId: session.user.id,
      documentId: parsed.documentId,
    });
    revalidatePath(`/app/${doc.workspaceId}`);
    return { workspaceId: doc.workspaceId };
  });
}

export async function actionToggleFavorite(input: {
  documentId: string;
}): Promise<ActionResult<{ favorited: boolean }>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z.object({ documentId: z.string().min(1) }).parse(input);
    return toggleFavorite(session.user.id, parsed.documentId);
  });
}

export async function actionMoveDocument(input: {
  documentId: string;
  newParentId: string | null;
}): Promise<ActionResult<undefined>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({
        documentId: z.string().min(1),
        newParentId: z.string().min(1).nullable(),
      })
      .parse(input);
    const doc = await moveDocument({ userId: session.user.id, ...parsed });
    revalidatePath(`/app/${doc.workspaceId}`);
    return undefined;
  });
}

/* -------------------------------------------------------------------------- */
/* Version history                                                             */
/* -------------------------------------------------------------------------- */

export async function actionListDocumentVersions(input: {
  documentId: string;
}): Promise<
  ActionResult<
    Array<{
      id: string;
      version: number;
      title: string;
      createdAt: string;
      createdByName: string | null;
    }>
  >
> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z.object({ documentId: z.string().min(1) }).parse(input);
    const versions = await listDocumentVersions(
      session.user.id,
      parsed.documentId,
    );
    return versions.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    }));
  });
}

export async function actionGetDocumentVersion(input: {
  documentId: string;
  versionId: string;
}): Promise<
  ActionResult<{
    id: string;
    version: number;
    title: string;
    contentJson: Record<string, unknown>;
    createdAt: string;
  } | null>
> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({ documentId: z.string().min(1), versionId: z.string().min(1) })
      .parse(input);
    const version = await getDocumentVersion(
      session.user.id,
      parsed.documentId,
      parsed.versionId,
    );
    if (!version) return null;
    return {
      id: version.id,
      version: version.version,
      title: version.title,
      contentJson: version.contentJson,
      createdAt: version.createdAt.toISOString(),
    };
  });
}

export async function actionRestoreDocumentVersion(input: {
  documentId: string;
  versionId: string;
}): Promise<ActionResult<undefined>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z
      .object({ documentId: z.string().min(1), versionId: z.string().min(1) })
      .parse(input);
    const doc = await restoreDocumentVersion({
      userId: session.user.id,
      ...parsed,
    });
    revalidatePath(`/app/${doc.workspaceId}/docs/${doc.id}`);
    return undefined;
  });
}

/* -------------------------------------------------------------------------- */
/* Access requests                                                             */
/* -------------------------------------------------------------------------- */

export async function actionRequestAccess(input: {
  documentId: string;
}): Promise<ActionResult<undefined>> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z.object({ documentId: z.string().min(1) }).parse(input);
    const result = await getDocumentWithAccess(
      session.user.id,
      parsed.documentId,
    );
    if (!result) throw new Error("NOT_FOUND");
    if (result.access !== "none") return undefined; // already has access

    const workspace = await getWorkspaceById(result.doc.workspaceId);
    if (!workspace || workspace.isPersonal) {
      // Never reveal anything about personal notebooks.
      return undefined;
    }

    const db = getDb();
    const admins = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspace.id),
          inArray(workspaceMembers.role, ["owner", "admin"]),
        ),
      );
    if (admins.length === 0) return undefined;
    const adminUsers = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(
        inArray(
          userTable.id,
          admins.map((a) => a.userId),
        ),
      );

    await sendAccessRequestEmail({
      to: adminUsers.map((u) => u.email),
      requesterName: session.user.name,
      requesterEmail: session.user.email,
      documentTitle: result.doc.title,
      workspaceName: workspace.name,
      settingsUrl: `${getAppUrl()}/app/${workspace.id}/settings`,
    });
    logger.info("document.access_requested", {
      documentId: parsed.documentId,
      requesterId: session.user.id,
    });
    return undefined;
  });
}

/* -------------------------------------------------------------------------- */
/* Search & uploads                                                            */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Workspace member data for dialogs                                           */
/* -------------------------------------------------------------------------- */

export async function actionListWorkspaceMembers(input: {
  workspaceId: string;
}): Promise<
  ActionResult<
    Array<{
      userId: string;
      name: string;
      email: string;
      image: string | null;
      role: string;
    }>
  >
> {
  const session = await requireVerifiedSession();
  return run(async () => {
    const parsed = z.object({ workspaceId: z.string().min(1) }).parse(input);
    const members = await listWorkspaceMembers({
      userId: session.user.id,
      workspaceId: parsed.workspaceId,
    });
    return members.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      image: m.image,
      role: m.role,
    }));
  });
}
