export type WorkspaceRole = "owner" | "admin" | "member" | "guest";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  guest: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export function roleAtLeast(
  role: WorkspaceRole,
  minimum: WorkspaceRole,
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function canEditDocuments(role: WorkspaceRole): boolean {
  return roleAtLeast(role, "member");
}

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return roleAtLeast(role, "admin");
}

export function canInvite(role: WorkspaceRole): boolean {
  return roleAtLeast(role, "admin");
}
