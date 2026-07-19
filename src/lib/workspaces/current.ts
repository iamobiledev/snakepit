import "server-only";
import { notFound } from "next/navigation";
import { requireVerifiedSession } from "@/lib/session";
import { listUserWorkspaces } from "@/lib/documents/service";

type UserWorkspace = Awaited<
  ReturnType<typeof listUserWorkspaces>
>[number];

/**
 * Shared entry point for `/app/[workspaceId]/*` pages: require a verified
 * session and resolve the workspace the user can access, or `notFound()`.
 */
export async function requireWorkspaceAccess(workspaceId: string): Promise<{
  session: Awaited<ReturnType<typeof requireVerifiedSession>>;
  workspace: UserWorkspace;
}> {
  const session = await requireVerifiedSession();
  const workspaces = await listUserWorkspaces(session.user.id);
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) notFound();
  return { session, workspace };
}
