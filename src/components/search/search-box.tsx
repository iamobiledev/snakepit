"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SearchHit } from "@/lib/search/types";

export function SearchBox({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!deferredQuery) {
      startTransition(() => {
        setHits([]);
        setOpen(false);
      });
      return;
    }

    const handle = setTimeout(() => {
      startTransition(async () => {
        const params = new URLSearchParams({ q: deferredQuery });
        if (workspaceId) params.set("workspaceId", workspaceId);
        const res = await fetch(`/api/search?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits);
        setOpen(true);
      });
    }, 250);

    return () => clearTimeout(handle);
  }, [deferredQuery, workspaceId]);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Search documents…"
          className="pl-9"
          aria-label="Search documents"
        />
      </div>
      {open && (hits.length > 0 || pending) && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card)] shadow-sm">
          {pending && hits.length === 0 && (
            <p className="px-3 py-2 text-sm text-[var(--muted-foreground)]">
              Searching…
            </p>
          )}
          <ul>
            {hits.map((hit) => (
              <li key={hit.documentId}>
                <Link
                  href={`/app/${hit.workspaceId}/docs/${hit.documentId}`}
                  className="block px-3 py-2 hover:bg-[var(--muted)]"
                  onClick={() => setOpen(false)}
                >
                  <div className="text-sm font-medium">{hit.title}</div>
                  <div className="truncate text-xs text-[var(--muted-foreground)]">
                    {hit.breadcrumbPath || hit.snippet}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
