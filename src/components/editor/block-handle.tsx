"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import DragHandle from "@tiptap/extension-drag-handle-react";
import {
  Check,
  CheckSquare,
  ChevronRight,
  Code,
  Copy,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Plus,
  Text,
  TextQuote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { TURN_INTO_OPTIONS, getActiveTurnIntoLabel } from "./turn-into";

type BlockHandleProps = {
  editor: Editor;
};

type HoveredBlock = {
  node: ProseMirrorNode;
  pos: number;
};

const TURN_INTO_ICONS: Record<string, LucideIcon> = {
  Text,
  "Heading 1": Heading1,
  "Heading 2": Heading2,
  "Heading 3": Heading3,
  "Bulleted list": List,
  "Numbered list": ListOrdered,
  "To-do list": CheckSquare,
  Quote: TextQuote,
  Code,
};

/**
 * Notion-style left-gutter controls: hover-reveal +, drag handle, and a
 * block menu (delete / duplicate / turn into). Drag-and-drop reordering is
 * provided by TipTap’s DragHandle; the blue drop indicator is styled in CSS.
 *
 * The grip is intentionally not a Radix DropdownMenuTrigger — Radix opens on
 * pointerdown and would cancel HTML5 drag. Click opens the menu; drag moves
 * the block.
 */
export function BlockHandle({ editor }: BlockHandleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [turnIntoOpen, setTurnIntoOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hoveredRef = useRef<HoveredBlock | null>(null);
  const hoveredDomRef = useRef<HTMLElement | null>(null);
  const menuBlockRef = useRef<HoveredBlock | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  // Ignore the click that browsers fire after a completed drag.
  const skipClickRef = useRef(false);

  const clearHoverHighlight = useCallback(() => {
    hoveredDomRef.current?.classList.remove("is-block-hovered");
    hoveredDomRef.current = null;
  }, []);

  const onNodeChange = useCallback(
    ({
      node,
      pos,
    }: {
      node: ProseMirrorNode | null;
      editor: Editor;
      pos: number;
    }) => {
      clearHoverHighlight();
      if (!node || pos < 0) {
        hoveredRef.current = null;
        return;
      }
      hoveredRef.current = { node, pos };
      const dom = editor.view.nodeDOM(pos);
      if (dom instanceof HTMLElement) {
        dom.classList.add("is-block-hovered");
        hoveredDomRef.current = dom;
      }
    },
    [clearHoverHighlight, editor],
  );

  useEffect(() => {
    return () => clearHoverHighlight();
  }, [clearHoverHighlight]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setTurnIntoOpen(false);
    menuBlockRef.current = null;
    editor.view.dispatch(
      editor.view.state.tr.setMeta("lockDragHandle", false),
    );
  }, [editor]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (gripRef.current?.contains(target)) return;
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  const selectBlock = useCallback(
    (block: HoveredBlock) => {
      const { pos, node } = block;
      if (node.isTextblock) {
        editor.commands.setTextSelection({
          from: pos + 1,
          to: pos + node.nodeSize - 1,
        });
      } else {
        editor.commands.setNodeSelection(pos);
      }
    },
    [editor],
  );

  const openMenu = useCallback(() => {
    const block = hoveredRef.current;
    if (!block) return;
    menuBlockRef.current = block;
    selectBlock(block);
    setTurnIntoOpen(false);
    setMenuOpen(true);
    editor.view.dispatch(
      editor.view.state.tr.setMeta("lockDragHandle", true),
    );
  }, [editor, selectBlock]);

  const insertBlockBelow = useCallback(() => {
    const block = hoveredRef.current;
    if (!block) return;
    const insertPos = block.pos + block.node.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, { type: "paragraph" })
      .setTextSelection(insertPos + 1)
      .run();
  }, [editor]);

  const deleteBlock = useCallback(() => {
    const block = menuBlockRef.current;
    if (!block) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: block.pos, to: block.pos + block.node.nodeSize })
      .run();
    closeMenu();
  }, [editor, closeMenu]);

  const duplicateBlock = useCallback(() => {
    const block = menuBlockRef.current;
    if (!block) return;
    const insertPos = block.pos + block.node.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, block.node.toJSON())
      .run();
    closeMenu();
  }, [editor, closeMenu]);

  const applyTurnInto = useCallback(
    (apply: (editor: Editor) => void) => {
      const block = menuBlockRef.current;
      if (!block) return;
      selectBlock(block);
      apply(editor);
      closeMenu();
    },
    [editor, selectBlock, closeMenu],
  );

  const activeLabel = getActiveTurnIntoLabel(editor);

  return (
    <DragHandle
      editor={editor}
      nested
      computePositionConfig={{
        placement: "left-start",
        strategy: "absolute",
      }}
      onNodeChange={onNodeChange}
      onElementDragStart={() => {
        skipClickRef.current = true;
        setDragging(true);
        closeMenu();
      }}
      onElementDragEnd={() => {
        setDragging(false);
        // Drop the synthetic click that follows some dragends.
        window.setTimeout(() => {
          skipClickRef.current = false;
        }, 0);
      }}
      className="block-drag-handle"
    >
      <div className="relative flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Add block below"
          title="Click to add below"
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            insertBlockBelow();
          }}
          draggable={false}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <button
          ref={gripRef}
          type="button"
          aria-label="Drag or open block options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Drag to move · click for options"
          className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)] active:cursor-grabbing"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (skipClickRef.current || dragging) return;
            if (menuOpen) {
              closeMenu();
              return;
            }
            openMenu();
          }}
        >
          <GripVertical className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Block options"
            className="absolute top-0 right-full z-50 mr-2 w-52 animate-fade rounded-md border border-[var(--border)] bg-[var(--card)] p-1 text-[var(--foreground)] shadow-md"
          >
            <MenuItem
              destructive
              onSelect={deleteBlock}
              shortcut="Del"
              icon={Trash2}
            >
              Delete
            </MenuItem>
            <MenuItem onSelect={duplicateBlock} shortcut="⌘D" icon={Copy}>
              Duplicate
            </MenuItem>
            <div className="-mx-1 my-1 h-px bg-[var(--border)]" />
            <div className="relative">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={turnIntoOpen}
                className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[var(--muted)] focus:bg-[var(--muted)]"
                onMouseEnter={() => setTurnIntoOpen(true)}
                onFocus={() => setTurnIntoOpen(true)}
                onClick={() => setTurnIntoOpen((open) => !open)}
              >
                <Text className="h-4 w-4" />
                Turn into
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              </button>
              {turnIntoOpen && (
                <div
                  role="menu"
                  aria-label="Turn into"
                  className="absolute top-0 right-full z-50 mr-1 w-48 animate-fade rounded-md border border-[var(--border)] bg-[var(--card)] p-1 shadow-md"
                  onMouseEnter={() => setTurnIntoOpen(true)}
                >
                  {TURN_INTO_OPTIONS.map((option) => {
                    const Icon = TURN_INTO_ICONS[option.label] ?? Text;
                    return (
                      <MenuItem
                        key={option.label}
                        icon={Icon}
                        onSelect={() => applyTurnInto(option.apply)}
                        trailing={
                          option.label === activeLabel ? (
                            <Check className="ml-auto h-3.5 w-3.5 text-[var(--primary)]" />
                          ) : null
                        }
                      >
                        {option.label}
                      </MenuItem>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DragHandle>
  );
}

function MenuItem({
  children,
  onSelect,
  icon: Icon,
  shortcut,
  trailing,
  destructive,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  icon: LucideIcon;
  shortcut?: string;
  trailing?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[var(--muted)] focus:bg-[var(--muted)] ${
        destructive ? "text-[var(--destructive)]" : ""
      }`}
      onClick={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <Icon className="h-4 w-4" />
      {children}
      {trailing}
      {shortcut && !trailing && (
        <span className="ml-auto text-xs text-[var(--muted-foreground)]">
          {shortcut}
        </span>
      )}
    </button>
  );
}
