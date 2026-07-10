"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
} from "lucide-react";

type DocumentEditorProps = {
  documentId: string;
  initialTitle: string;
  initialContent: Record<string, unknown>;
  onSave: (payload: {
    title: string;
    contentJson: Record<string, unknown>;
  }) => Promise<void>;
  readOnly?: boolean;
};

export function DocumentEditor({
  documentId,
  initialTitle,
  initialContent,
  onSave,
  readOnly = false,
}: DocumentEditorProps) {
  const [isPending, startTransition] = useTransition();
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      Image.configure({ allowBase64: false }),
      Link.configure({ openOnClick: false }),
    ],
    content: initialContent,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral max-w-none min-h-[50vh] focus:outline-none px-1",
      },
    },
  });

  useEffect(() => {
    if (!editor || readOnly) return;
    const handle = setInterval(() => {
      const titleEl = document.getElementById(
        `doc-title-${documentId}`,
      ) as HTMLInputElement | null;
      const title = titleEl?.value?.trim() || "Untitled";
      const contentJson = editor.getJSON() as Record<string, unknown>;
      startTransition(() => {
        void onSave({ title, contentJson });
      });
    }, 8000);
    return () => clearInterval(handle);
  }, [editor, documentId, onSave, readOnly]);

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] pb-3">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            label="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            label="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            label="Heading"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            label="Bullet list"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            label="Ordered list"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            label="Quote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            label="Undo"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            label="Redo"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
          <div className="ml-auto text-xs text-[var(--muted-foreground)]">
            {isPending ? "Saving…" : "Autosave on"}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const titleEl = document.getElementById(
                `doc-title-${documentId}`,
              ) as HTMLInputElement | null;
              const title = titleEl?.value?.trim() || "Untitled";
              const contentJson = editor.getJSON() as Record<string, unknown>;
              startTransition(() => {
                void onSave({ title, contentJson });
              });
            }}
          >
            Save
          </Button>
        </div>
      )}

      {readOnly ? (
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          {initialTitle}
        </h1>
      ) : (
        <input
          id={`doc-title-${documentId}`}
          defaultValue={initialTitle}
          className="w-full bg-transparent font-[family-name:var(--font-display)] text-4xl tracking-tight outline-none placeholder:text-[var(--muted-foreground)]"
          placeholder="Untitled"
        />
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
        active
          ? "bg-[var(--muted)] text-[var(--foreground)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
      }`}
    >
      {children}
    </button>
  );
}
