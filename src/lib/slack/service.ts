import "server-only";

/**
 * Slack connection persistence.
 * Fully implemented with the Slack integration milestone — the placeholder
 * keeps status checks working before the Slack tables exist.
 */
export async function getConnectionForWorkspace(workspaceId: string): Promise<{
  slackTeamId: string;
  slackTeamName: string;
} | null> {
  void workspaceId;
  return null;
}
