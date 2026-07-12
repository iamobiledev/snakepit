"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  actionListDocumentVersions,
  actionGetDocumentVersion,
  actionRestoreDocumentVersion,
} from "@/app/actions";
import { ReadOnlyDoc } from "./read-only-doc";

type VersionSummary = {
  id: string;
  version: number;
  title: string;
  createdAt: string;
  createdByName: string | null;
};

type VersionDetail = {
  id: string;
  version: number;
  title: string;
  contentJson: Record<string, unknown>;
  createdAt: string;
};

export function HistoryPanel({
  open,
  onOpenChange,
  documentId,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [selected, setSelected] = useState<VersionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoring, startRestoring] = useTransition();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setVersions(null);
        setSelected(null);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void actionListDocumentVersions({ documentId }).then((result) => {
      if (cancelled) return;
      if (result.ok) setVersions(result.data);
      else {
        toast.error(result.error);
        setVersions([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  const selectVersion = useCallback(
    async (versionId: string) => {
      setLoadingDetail(true);
      const result = await actionGetDocumentVersion({ documentId, versionId });
      setLoadingDetail(false);
      if (result.ok && result.data) setSelected(result.data);
      else toast.error(result.ok ? "Version not found." : result.error);
    },
    [documentId],
  );

  const restore = () => {
    if (!selected) return;
    startRestoring(async () => {
      const result = await actionRestoreDocumentVersion({
        documentId,
        versionId: selected.id,
      });
      if (result.ok) {
        toast.success(`Restored version ${selected.version}`);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Version history
          </DialogTitle>
          <DialogDescription>
            Snapshots are taken automatically on significant edits. Restoring
            keeps a snapshot of the current version, so nothing is ever lost.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-hidden sm:grid-cols-[220px_1fr]">
          <div className="overflow-y-auto rounded-md border border-[var(--border)]">
            {versions === null && (
              <div className="space-y-2 p-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded bg-[var(--muted)]"
                  />
                ))}
              </div>
            )}
            {versions?.length === 0 && (
              <p className="p-4 text-sm text-[var(--muted-foreground)]">
                No snapshots yet. Keep editing — versions appear here after
                significant changes.
              </p>
            )}
            <ul>
              {versions?.map((version) => (
                <li key={version.id}>
                  <button
                    type="button"
                    onClick={() => void selectVersion(version.id)}
                    className={`w-full px-3 py-2 text-left transition-colors hover:bg-[var(--muted)] ${
                      selected?.id === version.id ? "bg-[var(--muted)]" : ""
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      v{version.version} · {version.title || "Untitled"}
                    </span>
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {format(new Date(version.createdAt), "MMM d, yyyy h:mm a")}
                      {version.createdByName && ` · ${version.createdByName}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-y-auto rounded-md border border-[var(--border)] p-4">
            {loadingDetail && (
              <div className="flex h-full items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
              </div>
            )}
            {!loadingDetail && !selected && (
              <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
                Select a version to preview it.
              </p>
            )}
            {!loadingDetail && selected && (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                    {selected.title || "Untitled"}
                  </h3>
                  {canEdit && (
                    <Button size="sm" onClick={restore} disabled={restoring}>
                      {restoring ? "Restoring…" : "Restore this version"}
                    </Button>
                  )}
                </div>
                <ReadOnlyDoc contentJson={selected.contentJson} />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
