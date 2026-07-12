"use client";

import { MessageSquare } from "lucide-react";

/**
 * Slack connection settings.
 * The connect/disconnect + account-linking flows are wired up with the Slack
 * integration milestone — this renders honest states until then.
 */
export function SlackSection({
  workspaceId,
  isPersonal,
  isAdmin,
  slack,
}: {
  workspaceId: string;
  isPersonal: boolean;
  isAdmin: boolean;
  slack: { configured: boolean; connected: boolean; teamName: string | null };
}) {
  void workspaceId;
  void isAdmin;
  if (isPersonal) return null;

  return (
    <section aria-labelledby="slack-heading" id="slack">
      <h2 id="slack-heading" className="flex items-center gap-2 text-lg font-medium">
        <MessageSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
        Slack
      </h2>
      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        {!slack.configured ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Slack isn’t configured for this deployment yet. Add the Slack app
            credentials to the environment (see the README) to enable document
            previews, search, and sharing inside Slack.
          </p>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            Slack integration is being set up.
          </p>
        )}
      </div>
    </section>
  );
}
