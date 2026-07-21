import "server-only";
import { revalidatePath } from "next/cache";
import { getWorkspaceById } from "@/lib/workspaces/service";
import { workspaceRoutePaths } from "@/lib/workspaces/paths";

export async function revalidateWorkspaceRoute(
  workspaceId: string,
  suffix = "",
  type?: "page" | "layout",
): Promise<void> {
  const workspace = await getWorkspaceById(workspaceId);
  const paths = workspace
    ? workspaceRoutePaths(workspace, suffix)
    : [`/app/${workspaceId}${suffix}`];

  for (const path of paths) {
    revalidatePath(path, type);
  }
}
