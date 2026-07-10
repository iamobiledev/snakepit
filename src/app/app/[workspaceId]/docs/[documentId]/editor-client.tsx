"use client";

import { useCallback } from "react";
import { DocumentEditor } from "@/components/editor/document-editor";
import { actionSaveDocument } from "@/app/actions";

export function DocumentEditorClient({
  documentId,
  initialTitle,
  initialContent,
}: {
  documentId: string;
  initialTitle: string;
  initialContent: Record<string, unknown>;
}) {
  const onSave = useCallback(
    async (payload: {
      title: string;
      contentJson: Record<string, unknown>;
    }) => {
      await actionSaveDocument({
        documentId,
        title: payload.title,
        contentJson: payload.contentJson,
      });
    },
    [documentId],
  );

  return (
    <DocumentEditor
      documentId={documentId}
      initialTitle={initialTitle}
      initialContent={initialContent}
      onSave={onSave}
    />
  );
}
