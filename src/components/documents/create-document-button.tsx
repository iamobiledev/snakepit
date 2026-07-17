"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDocumentAndNavigate } from "@/components/documents/create-document";

export function CreateDocumentButton({
  workspaceId,
  docType = "doc",
  label,
  variant = "default",
  className,
}: {
  workspaceId: string;
  docType?: "doc" | "wiki";
  label: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={pending}
      onClick={() => {
        if (pending) return;
        startTransition(() =>
          createDocumentAndNavigate(router, { workspaceId, docType }),
        );
      }}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : docType === "wiki" ? (
        <BookOpen className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {pending ? "Creating…" : label}
    </Button>
  );
}
