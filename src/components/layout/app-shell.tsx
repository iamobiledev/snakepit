"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookLock,
  BookOpen,
  ChevronsUpDown,
  Menu,
  Plus,
  Search,
  Settings,
  Trash2,
  LogOut,
  Keyboard,
} from "lucide-react";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { signOut } from "@/lib/auth-client";
import { actionCreateDocument } from "@/app/actions";
import type { DocumentTreeNode, WorkspaceSummary } from "@/lib/documents/types";
import { DocumentTree } from "./document-tree";
import { CommandPalette } from "@/components/search/command-palette";
import { ShortcutsDialog } from "./shortcuts-dialog";

type AppShellProps = {
  user: { name: string; email: string };
  platformRole: "admin" | "developer";
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  tree: DocumentTreeNode[];
  favorites: Array<{ id: string; title: string }>;
  children: React.ReactNode;
};

export function AppShell({
  user,
  platformRole,
  workspace,
  workspaces,
  tree,
  favorites,
  children,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [creating, startCreating] = useTransition();

  const canEditDocs = workspace.role !== "guest";

  const createPage = useCallback(
    (parentId?: string, docType: "doc" | "wiki" = "doc") => {
      if (!canEditDocs || creating) return;
      startCreating(async () => {
        try {
          const formData = new FormData();
          formData.set("workspaceId", workspace.id);
          if (parentId) formData.set("parentId", parentId);
          formData.set("title", "Untitled");
          formData.set("docType", docType);
          const doc = await actionCreateDocument(formData);
          router.push(`/app/${workspace.id}/docs/${doc.id}`);
        } catch {
          toast.error("Couldn't create the page. Please try again.");
        }
      });
    },
    [canEditDocs, creating, router, workspace.id],
  );

  // Global keyboard shortcuts (Cmd+K handled by the palette itself).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      if (event.key === "?" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
      if (
        (event.key === "n" || event.key === "N") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        createPage();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createPage]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <WorkspaceSwitcher
        current={workspace}
        workspaces={workspaces}
        canCreateWorkspace={platformRole === "admin"}
      />

      <div className="mt-4 px-2">
        <button
          type="button"
          onClick={() => {
            const event = new CustomEvent("docloom:open-search");
            window.dispatchEvent(event);
          }}
          className="flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Search className="h-4 w-4" />
          <span>Search…</span>
          <kbd className="ml-auto rounded border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
      </div>

      {canEditDocs && (
        <div className="mt-2 flex items-center gap-1 px-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-[var(--primary)]"
            onClick={() => createPage()}
            disabled={creating}
          >
            <Plus className="h-4 w-4" />
            New page
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--muted-foreground)]"
                aria-label="More page types"
                disabled={creating}
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onSelect={() => createPage(undefined, "doc")}>
                <Plus className="h-4 w-4" />
                New page
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => createPage(undefined, "wiki")}>
                <BookOpen className="h-4 w-4" />
                New wiki
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <nav
        aria-label="Documents"
        className="mt-4 flex-1 space-y-6 overflow-y-auto px-2 pb-6"
      >
        {favorites.length > 0 && (
          <div>
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Favorites
            </p>
            <ul>
              {favorites.map((fav) => (
                <li key={fav.id}>
                  <Link
                    href={`/app/${workspace.id}/docs/${fav.id}`}
                    className={`block truncate rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--muted)] ${
                      pathname?.endsWith(`/docs/${fav.id}`)
                        ? "bg-[var(--muted)] font-medium"
                        : ""
                    }`}
                  >
                    ★ <span className="ml-1">{fav.title || "Untitled"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Pages
          </p>
          {tree.length === 0 ? (
            <p className="px-2 py-1 text-sm text-[var(--muted-foreground)]">
              No pages yet.
              {canEditDocs && " Press N or click New page to start writing."}
            </p>
          ) : (
            <DocumentTree
              nodes={tree}
              workspaceId={workspace.id}
              activePath={pathname ?? ""}
              onCreateChild={canEditDocs ? createPage : undefined}
            />
          )}
        </div>
      </nav>

      <div className="border-t border-[var(--border)] px-2 py-3">
        <Link
          href={`/app/${workspace.id}/trash`}
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--muted)] ${
            pathname?.endsWith("/trash") ? "bg-[var(--muted)] font-medium" : ""
          }`}
        >
          <Trash2 className="h-4 w-4 text-[var(--muted-foreground)]" />
          Trash
        </Link>
        <Link
          href={`/app/${workspace.id}/settings`}
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--muted)] ${
            pathname?.endsWith("/settings") ? "bg-[var(--muted)] font-medium" : ""
          }`}
        >
          <Settings className="h-4 w-4 text-[var(--muted-foreground)]" />
          Settings
        </Link>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen w-full">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,transparent)] py-4 md:block">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DialogContent
            hideClose
            className="fixed inset-y-0 left-0 h-full w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0 py-4 top-0 data-[state=open]:animate-fade md:hidden"
            style={{ left: 0, top: 0, transform: "none" }}
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            {/* Close the drawer when any link inside is followed. */}
            <div
              className="h-full"
              onClickCapture={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("a")) setDrawerOpen(false);
              }}
            >
              {sidebar}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,transparent)] px-4 py-3 backdrop-blur md:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Link
              href={`/app/${workspace.id}`}
              className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--primary)]"
            >
              {workspace.isPersonal && <BookLock className="h-4 w-4" />}
              <span className="truncate">{workspace.name}</span>
            </Link>

            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 md:hidden"
                aria-label="Search"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("docloom:open-search"))
                }
              >
                <Search className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Avatar name={user.name} className="h-8 w-8 text-xs" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="normal-case tracking-normal">
                    <span className="block text-sm font-medium text-[var(--foreground)]">
                      {user.name}
                    </span>
                    <span className="block truncate text-xs font-normal">
                      {user.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                    <Keyboard className="h-4 w-4" />
                    Keyboard shortcuts
                    <kbd className="ml-auto text-xs text-[var(--muted-foreground)]">
                      ?
                    </kbd>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={async () => {
                      await signOut();
                      router.push("/sign-in");
                      router.refresh();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>

      <CommandPalette workspaceId={workspace.id} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </TooltipProvider>
  );
}

function WorkspaceSwitcher({
  current,
  workspaces,
  canCreateWorkspace,
}: {
  current: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  canCreateWorkspace: boolean;
}) {
  const personal = workspaces.filter((w) => w.isPersonal);
  const shared = workspaces.filter((w) => !w.isPersonal);

  return (
    <div className="px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {current.isPersonal ? (
              <BookLock className="h-4 w-4 shrink-0 text-[var(--primary)]" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--primary)] text-xs font-semibold text-[var(--primary-foreground)]">
                {current.name[0]?.toUpperCase() ?? "W"}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {current.name}
              </span>
              <span className="block text-[11px] text-[var(--muted-foreground)]">
                {brand.name}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {personal.length > 0 && (
            <>
              <DropdownMenuLabel>Private</DropdownMenuLabel>
              {personal.map((ws) => (
                <DropdownMenuItem key={ws.id} asChild>
                  <Link href={`/app/${ws.id}`}>
                    <BookLock className="h-4 w-4" />
                    {ws.name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {shared.length === 0 && (
            <p className="px-2 pb-1.5 text-xs text-[var(--muted-foreground)]">
              No shared workspaces yet.
            </p>
          )}
          {shared.map((ws) => (
            <DropdownMenuItem key={ws.id} asChild>
              <Link href={`/app/${ws.id}`}>
                <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--secondary)] text-[10px] font-semibold text-[var(--secondary-foreground)]">
                  {ws.name[0]?.toUpperCase() ?? "W"}
                </span>
                {ws.name}
              </Link>
            </DropdownMenuItem>
          ))}
          {canCreateWorkspace && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/app/new" className="text-[var(--primary)]">
                  <Plus className="h-4 w-4" />
                  New workspace
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
