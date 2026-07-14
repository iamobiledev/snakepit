import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  documentSearchBlocks,
  type Database,
} from "@/db";
import {
  normalizeDocumentBlocks,
  type SearchableDocumentBlock,
} from "@/lib/documents/blocks";

export const EMBEDDING_DIMENSIONS = 512;
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_BLOCK_MAX_CHARS = 6_000;

export function buildBlockEmbeddingInput(opts: {
  title: string;
  blockType: string;
  text: string;
}): string {
  const title = opts.title.replace(/\s+/g, " ").trim().slice(0, 500);
  const text = opts.text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, EMBEDDING_BLOCK_MAX_CHARS);
  return `Document: ${title || "Untitled"}\n${opts.blockType}: ${text}`;
}

export function embeddingInputHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export type PreparedSearchBlock = SearchableDocumentBlock & {
  embeddingInput: string;
  inputHash: string;
};

export function prepareDocumentSearchBlocks(opts: {
  title: string;
  contentJson: Record<string, unknown>;
}): {
  contentJson: Record<string, unknown>;
  blocks: PreparedSearchBlock[];
  changed: boolean;
} {
  const normalized = normalizeDocumentBlocks(opts.contentJson);
  return {
    contentJson: normalized.contentJson,
    changed: normalized.changed,
    blocks: normalized.blocks.map((block) => {
      const embeddingInput = buildBlockEmbeddingInput({
        title: opts.title,
        blockType: block.blockType,
        text: block.text,
      });
      return {
        ...block,
        embeddingInput,
        inputHash: embeddingInputHash(embeddingInput),
      };
    }),
  };
}

/**
 * Mirror the current document's searchable paragraphs into relational rows.
 * Changed inputs lose their stale vector immediately; unchanged blocks retain
 * their vector even when neighboring paragraphs are edited or reordered.
 */
export async function syncDocumentSearchBlocks(opts: {
  db: Database;
  documentId: string;
  title: string;
  contentJson: Record<string, unknown>;
}): Promise<PreparedSearchBlock[]> {
  const prepared = prepareDocumentSearchBlocks({
    title: opts.title,
    contentJson: opts.contentJson,
  });
  const existing = await opts.db
    .select({
      id: documentSearchBlocks.id,
      blockId: documentSearchBlocks.blockId,
      inputHash: documentSearchBlocks.inputHash,
    })
    .from(documentSearchBlocks)
    .where(eq(documentSearchBlocks.documentId, opts.documentId));
  const existingByBlockId = new Map(existing.map((row) => [row.blockId, row]));

  for (const block of prepared.blocks) {
    const current = existingByBlockId.get(block.blockId);
    if (!current) {
      await opts.db.insert(documentSearchBlocks).values({
        id: nanoid(),
        documentId: opts.documentId,
        blockId: block.blockId,
        blockType: block.blockType,
        position: block.position,
        textContent: block.text.slice(0, EMBEDDING_BLOCK_MAX_CHARS),
        inputHash: block.inputHash,
      });
      continue;
    }

    const inputChanged = current.inputHash !== block.inputHash;
    await opts.db
      .update(documentSearchBlocks)
      .set({
        blockType: block.blockType,
        position: block.position,
        textContent: block.text.slice(0, EMBEDDING_BLOCK_MAX_CHARS),
        inputHash: block.inputHash,
        ...(inputChanged ? { embedding: null, embeddedAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentSearchBlocks.documentId, opts.documentId),
          eq(documentSearchBlocks.blockId, block.blockId),
        ),
      );
  }

  const currentBlockIds = prepared.blocks.map((block) => block.blockId);
  const removedRowIds = existing
    .filter((row) => !currentBlockIds.includes(row.blockId))
    .map((row) => row.id);
  if (removedRowIds.length > 0) {
    await opts.db
      .delete(documentSearchBlocks)
      .where(inArray(documentSearchBlocks.id, removedRowIds));
  }

  return prepared.blocks;
}
