import "server-only";
import { eq } from "drizzle-orm";
import { getDb, user as userTable } from "@/db";
import { getAppUrl } from "@/env/server";
import { brand } from "@/config/brand";
import { documentCard, type SlackBlock } from "./blocks";

/** Canonical in-app URL for a document. */
export function documentUrl(workspaceId: string, documentId: string): string {
  return `${getAppUrl()}/app/${workspaceId}/docs/${documentId}`;
}

/**
 * Build the Block Kit card for a document being shared into Slack: looks up
 * the creator's name and resolves the in-app URL, then delegates to
 * `documentCard`. Shared by "Share to Slack" (server action) and the
 * "Share to channel" interactive handler.
 */
export async function buildSharedDocumentCard(
  doc: {
    id: string;
    workspaceId: string;
    title: string;
    plainTextContent: string;
    updatedAt: Date;
    createdById: string;
  },
  workspaceName?: string,
): Promise<SlackBlock[]> {
  const db = getDb();
  const [creator] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, doc.createdById))
    .limit(1);

  return documentCard({
    title: doc.title,
    excerptSource: doc.plainTextContent,
    authorName: creator?.name ?? "Unknown",
    updatedAt: doc.updatedAt,
    url: documentUrl(doc.workspaceId, doc.id),
    workspaceName,
    appName: brand.name,
  });
}
