import { Extension } from "@tiptap/react";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { nanoid } from "nanoid";
import {
  BLOCK_ID_ATTRIBUTE,
  blockDomId,
  isSearchableBlockType,
  isValidBlockId,
} from "@/lib/documents/blocks";

type BlockIdOptions = {
  assignIds: boolean;
};

const pluginKey = new PluginKey("docloomBlockIds");

function transactionWithMissingBlockIds(state: EditorState) {
  const seen = new Set<string>();
  let transaction = state.tr;
  let changed = false;

  state.doc.descendants((node, position) => {
    if (!isSearchableBlockType(node.type.name)) return;

    const current = node.attrs[BLOCK_ID_ATTRIBUTE] as unknown;
    let blockId = isValidBlockId(current) && !seen.has(current) ? current : "";
    if (!blockId) {
      do {
        blockId = nanoid();
      } while (seen.has(blockId));
      transaction = transaction.setNodeMarkup(position, undefined, {
        ...node.attrs,
        [BLOCK_ID_ATTRIBUTE]: blockId,
      });
      changed = true;
    }
    seen.add(blockId);
  });

  if (!changed) return null;
  transaction.setMeta("addToHistory", false);
  transaction.setMeta(pluginKey, true);
  return transaction;
}

/**
 * Stable anchors for paragraph-level search results.
 *
 * Editable instances repair missing/duplicated IDs. Read-only instances only
 * expose persisted IDs in the DOM and never mutate their content.
 */
export const BlockIdExtension = Extension.create<BlockIdOptions>({
  name: "docloomBlockIds",

  addOptions() {
    return { assignIds: true };
  },

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "codeBlock"],
        attributes: {
          [BLOCK_ID_ATTRIBUTE]: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) => {
              const blockId = attributes[BLOCK_ID_ATTRIBUTE] as unknown;
              if (!isValidBlockId(blockId)) return {};
              return {
                "data-block-id": blockId,
                id: blockDomId(blockId),
              };
            },
          },
        },
      },
    ];
  },

  onCreate() {
    if (!this.options.assignIds) return;
    const transaction = transactionWithMissingBlockIds(this.editor.state);
    if (transaction) this.editor.view.dispatch(transaction);
  },

  addProseMirrorPlugins() {
    if (!this.options.assignIds) return [];
    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          if (
            !transactions.some((transaction) => transaction.docChanged) ||
            transactions.some((transaction) => transaction.getMeta(pluginKey))
          ) {
            return null;
          }
          return transactionWithMissingBlockIds(newState);
        },
      }),
    ];
  },
});
