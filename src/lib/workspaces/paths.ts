export type WorkspaceRouteRef = {
  id: string;
  slug: string;
};

export type RouteSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function findWorkspaceByRouteKey<T extends WorkspaceRouteRef>(
  workspaces: readonly T[],
  routeKey: string,
): T | undefined {
  return workspaces.find(
    (workspace) =>
      workspace.slug === routeKey || workspace.id === routeKey,
  );
}

export function workspacePath(workspace: WorkspaceRouteRef): string {
  return `/app/${workspace.slug}`;
}

export function workspaceDocumentPath(
  workspace: WorkspaceRouteRef,
  documentId: string,
): string {
  return `${workspacePath(workspace)}/docs/${documentId}`;
}

export function workspaceRoutePaths(
  workspace: WorkspaceRouteRef,
  suffix = "",
): string[] {
  return [
    ...new Set([
      `/app/${workspace.id}${suffix}`,
      `${workspacePath(workspace)}${suffix}`,
    ]),
  ];
}

export function withSearchParams(
  path: string,
  searchParams: RouteSearchParams,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function workspacePathForId(
  workspaces: readonly WorkspaceRouteRef[],
  workspaceId: string,
): string {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  return workspace ? workspacePath(workspace) : `/app/${workspaceId}`;
}

export function workspaceDocumentPathForId(
  workspaces: readonly WorkspaceRouteRef[],
  workspaceId: string,
  documentId: string,
): string {
  return `${workspacePathForId(workspaces, workspaceId)}/docs/${documentId}`;
}
