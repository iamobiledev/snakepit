import "server-only";
import { del, put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getDb, files } from "@/db";
import { getServerEnv } from "@/env/server";
import { requireMembership, canEditDocuments } from "@/lib/permissions";
import { logger } from "@/lib/logger";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type UploadKind =
  | "avatar"
  | "workspace-icon"
  | "document-image"
  | "cover-image"
  | "attachment";

export type UploadInput = {
  file: File;
  userId: string;
  workspaceId: string;
  documentId?: string;
  kind: UploadKind;
  /** Public only for assets on published public documents */
  access?: "private" | "workspace" | "public";
};

function extensionFor(mime: string, filename: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 8) {
    return fromName;
  }
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  };
  return map[mime] ?? "bin";
}

/**
 * Upload to Vercel Blob and persist metadata in Neon.
 * Pathnames are unique and non-guessable.
 */
export async function uploadWorkspaceFile(input: UploadInput) {
  const env = getServerEnv();
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }

  const membership = await requireMembership(
    input.userId,
    input.workspaceId,
    "member",
  );
  if (!canEditDocuments(membership.role) && input.kind !== "avatar") {
    throw new Error("FORBIDDEN");
  }

  if (!ALLOWED_MIME_TYPES.has(input.file.type)) {
    throw new Error(`Unsupported file type: ${input.file.type}`);
  }
  if (input.file.size <= 0 || input.file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes`);
  }

  const access = input.access ?? "workspace";
  const ext = extensionFor(input.file.type, input.file.name);
  const pathname = `workspaces/${input.workspaceId}/${input.kind}/${nanoid(24)}.${ext}`;

  const blob = await put(pathname, input.file, {
    access: access === "public" ? "public" : "private",
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType: input.file.type,
    addRandomSuffix: false,
  });

  const db = getDb();
  const id = nanoid();
  const [record] = await db
    .insert(files)
    .values({
      id,
      workspaceId: input.workspaceId,
      uploadedById: input.userId,
      documentId: input.documentId,
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      originalFilename: input.file.name,
      mimeType: input.file.type,
      fileSize: input.file.size,
      access,
    })
    .returning();

  logger.info("blob.uploaded", {
    fileId: id,
    workspaceId: input.workspaceId,
    kind: input.kind,
    size: input.file.size,
  });

  return record;
}

/**
 * Soft-delete a file. Blob object is removed only when no other
 * non-deleted file row (or document version reference) still points at it.
 */
export async function softDeleteFile(opts: {
  fileId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireMembership(opts.userId, opts.workspaceId, "member");
  const db = getDb();

  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, opts.fileId),
        eq(files.workspaceId, opts.workspaceId),
        isNull(files.deletedAt),
      ),
    )
    .limit(1);

  if (!file) {
    throw new Error("NOT_FOUND");
  }

  await db
    .update(files)
    .set({ deletedAt: new Date() })
    .where(eq(files.id, file.id));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(files)
    .where(
      and(eq(files.blobPathname, file.blobPathname), isNull(files.deletedAt)),
    );

  if (Number(count) === 0) {
    const env = getServerEnv();
    if (env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(file.blobUrl, { token: env.BLOB_READ_WRITE_TOKEN });
        logger.info("blob.deleted", { pathname: file.blobPathname });
      } catch (error) {
        logger.warn("blob.delete_failed", {
          pathname: file.blobPathname,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
