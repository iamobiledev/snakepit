import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import {
  getDb,
  documents,
  documentVersions,
  workspaces,
  workspaceMembers,
  user,
  type Document,
} from "@/db";
import { requireMembership, canEditDocuments } from "@/lib/permissions";
import { extractPlainText } from "./plain-text";
import { slugify } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function listWorkspaceDocuments(
  userId: string,
  workspaceId: string,
) {
  await requireMembership(userId, workspaceId, "guest");
  const db = getDb();
  return db
    .select({
      id: documents.id,
      title: documents.title,
      parentId: documents.parentId,
      visibility: documents.visibility,
      publicSlug: documents.publicSlug,
      icon: documents.icon,
      updatedAt: documents.updatedAt,
      createdById: documents.createdById,
    })
    .from(documents)
    .where(
      and(eq(documents.workspaceId, workspaceId), isNull(documents.archivedAt)),
    )
    .orderBy(asc(documents.title));
}

export async function getDocumentForUser(
  userId: string,
  documentId: string,
): Promise<Document | null> {
  const db = getDb();
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) return null;
  await requireMembership(userId, doc.workspaceId, "guest");
  return doc;
}

export async function createDocument(opts: {
  userId: string;
  workspaceId: string;
  parentId?: string | null;
  title?: string;
}) {
  await requireMembership(opts.userId, opts.workspaceId, "member");
  const db = getDb();
  const id = nanoid();
  const title = opts.title?.trim() || "Untitled";

  let breadcrumbPath = title;
  if (opts.parentId) {
    const [parent] = await db
      .select({
        title: documents.title,
        breadcrumbPath: documents.breadcrumbPath,
      })
      .from(documents)
      .where(eq(documents.id, opts.parentId))
      .limit(1);
    if (parent) {
      breadcrumbPath = `${parent.breadcrumbPath || parent.title} / ${title}`;
    }
  }

  const [doc] = await db
    .insert(documents)
    .values({
      id,
      workspaceId: opts.workspaceId,
      parentId: opts.parentId ?? null,
      title,
      breadcrumbPath,
      contentJson: {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
      plainTextContent: "",
      createdById: opts.userId,
      updatedById: opts.userId,
    })
    .returning();

  return doc;
}

export async function saveDocumentContent(opts: {
  userId: string;
  documentId: string;
  title?: string;
  contentJson: Record<string, unknown>;
  createVersion?: boolean;
}) {
  const existing = await getDocumentForUser(opts.userId, opts.documentId);
  if (!existing) throw new Error("NOT_FOUND");

  const membership = await requireMembership(
    opts.userId,
    existing.workspaceId,
    "member",
  );
  if (!canEditDocuments(membership.role)) throw new Error("FORBIDDEN");

  const title = opts.title?.trim() || existing.title;
  const plainTextContent = extractPlainText(opts.contentJson);
  const db = getDb();

  if (opts.createVersion) {
    const [{ maxVersion }] = await db
      .select({
        maxVersion: sql<number>`coalesce(max(${documentVersions.version}), 0)`,
      })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, existing.id));

    await db.insert(documentVersions).values({
      id: nanoid(),
      documentId: existing.id,
      version: Number(maxVersion) + 1,
      title: existing.title,
      contentJson: existing.contentJson,
      plainTextContent: existing.plainTextContent,
      createdById: opts.userId,
    });
  }

  const [updated] = await db
    .update(documents)
    .set({
      title,
      contentJson: opts.contentJson,
      plainTextContent,
      updatedById: opts.userId,
      updatedAt: new Date(),
      searchVector: sql`setweight(to_tsvector('english', coalesce(${title}, '')), 'A')
        || setweight(to_tsvector('english', coalesce(${existing.breadcrumbPath}, '')), 'B')
        || setweight(to_tsvector('english', coalesce(${plainTextContent}, '')), 'C')`,
    })
    .where(eq(documents.id, existing.id))
    .returning();

  if (existing.visibility === "public" && existing.publicSlug) {
    revalidatePath(`/p/${existing.publicSlug}`);
  }

  return updated;
}

export async function publishDocument(opts: {
  userId: string;
  documentId: string;
  publish: boolean;
}) {
  const existing = await getDocumentForUser(opts.userId, opts.documentId);
  if (!existing) throw new Error("NOT_FOUND");
  await requireMembership(opts.userId, existing.workspaceId, "member");

  const db = getDb();
  let publicSlug = existing.publicSlug;

  if (opts.publish) {
    if (!publicSlug) {
      publicSlug = `${slugify(existing.title) || "doc"}-${nanoid(10)}`;
    }
  }

  const previousSlug = existing.publicSlug;

  const [updated] = await db
    .update(documents)
    .set({
      visibility: opts.publish ? "public" : "workspace",
      publicSlug: opts.publish ? publicSlug : existing.publicSlug,
      publishedAt: opts.publish ? new Date() : null,
      updatedById: opts.userId,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, existing.id))
    .returning();

  if (previousSlug) {
    revalidatePath(`/p/${previousSlug}`);
  }
  if (updated.publicSlug && updated.publicSlug !== previousSlug) {
    revalidatePath(`/p/${updated.publicSlug}`);
  }

  logger.info("document.publish", {
    documentId: existing.id,
    publish: opts.publish,
  });

  return updated;
}

export async function getPublicDocument(slug: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: documents.id,
      title: documents.title,
      contentJson: documents.contentJson,
      plainTextContent: documents.plainTextContent,
      coverImageUrl: documents.coverImageUrl,
      icon: documents.icon,
      publishedAt: documents.publishedAt,
      updatedAt: documents.updatedAt,
      publicSlug: documents.publicSlug,
      visibility: documents.visibility,
      creatorName: user.name,
      workspaceName: workspaces.name,
    })
    .from(documents)
    .innerJoin(user, eq(user.id, documents.createdById))
    .innerJoin(workspaces, eq(workspaces.id, documents.workspaceId))
    .where(
      and(
        eq(documents.publicSlug, slug),
        eq(documents.visibility, "public"),
        isNull(documents.archivedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function listUserWorkspaces(userId: string) {
  const db = getDb();
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      iconUrl: workspaces.iconUrl,
      role: workspaceMembers.role,
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaces.id),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .orderBy(asc(workspaces.name));
}

export async function getRecentDocuments(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "guest");
  const db = getDb();
  return db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      icon: documents.icon,
    })
    .from(documents)
    .where(
      and(eq(documents.workspaceId, workspaceId), isNull(documents.archivedAt)),
    )
    .orderBy(desc(documents.updatedAt))
    .limit(12);
}
