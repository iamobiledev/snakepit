import type { WorkspaceRole } from "@/lib/roles";
import { roleAtLeast } from "@/lib/roles";

/**
 * Document access levels, from lowest to highest.
 */
export type DocumentAccess = "none" | "viewer" | "editor";

export type DocumentVisibility = "private" | "workspace" | "public";

export type PlatformRole = "admin" | "developer";

export type AccessInput = {
  /** Document visibility flag. */
  visibility: DocumentVisibility;
  /** Whether the requesting user created the document. */
  isCreator: boolean;
  /** The requesting user's role in the document's workspace (null = not a member). */
  membershipRole: WorkspaceRole | null;
  /** Whether the document is in the trash (archived). */
  archived: boolean;
  /** Document type — wikis support locking. */
  docType?: "doc" | "wiki";
  /** Whether the wiki is currently locked. */
  locked?: boolean;
  /** The requesting user's platform role (admin | developer). */
  platformRole?: PlatformRole;
};

/**
 * Single source of truth for document access decisions.
 *
 * Model (agreed with the team):
 * - Personal notebooks are single-member workspaces, so membership alone
 *   scopes them to their owner.
 * - Any document in a workspace is available to everyone in that workspace.
 *   Guests are read-only; members and above can edit.
 * - `private` visibility is a defensive extra: only the creator can access.
 * - `public` documents are additionally readable by anyone via /p/[slug]
 *   (handled by the public page — this function covers in-app access).
 * - Trashed documents are read-only (restore first to edit).
 * - Locked wikis are read-only for everyone except workspace owners/admins
 *   and platform `admin` users (who must still be workspace members).
 *
 * This is used by the app, mirrored in search SQL, and by Slack unfurling —
 * keep all of them in sync when the model changes.
 */
export function computeDocumentAccess(input: AccessInput): DocumentAccess {
  const { visibility, isCreator, membershipRole, archived } = input;

  // Not a member of the document's workspace → no in-app access.
  if (!membershipRole) return "none";

  // Defensive: private documents are creator-only even inside a workspace.
  if (visibility === "private" && !isCreator) return "none";

  const canEdit = roleAtLeast(membershipRole, "member");

  // Trashed documents can be viewed (in trash) but never edited in place.
  if (archived) return "viewer";

  // Locked wikis: only workspace admins/owners or platform admins can edit.
  if (input.docType === "wiki" && input.locked) {
    const canManageLocked =
      roleAtLeast(membershipRole, "admin") || input.platformRole === "admin";
    if (!canManageLocked) return "viewer";
  }

  return canEdit ? "editor" : "viewer";
}

/** Whether a user may lock/unlock a wiki (must also have view access). */
export function canManageWikiLock(opts: {
  membershipRole: WorkspaceRole | null;
  platformRole?: PlatformRole;
}): boolean {
  if (!opts.membershipRole) return false;
  return (
    roleAtLeast(opts.membershipRole, "admin") || opts.platformRole === "admin"
  );
}

export function canView(access: DocumentAccess): boolean {
  return access === "viewer" || access === "editor";
}

export function canEdit(access: DocumentAccess): boolean {
  return access === "editor";
}
