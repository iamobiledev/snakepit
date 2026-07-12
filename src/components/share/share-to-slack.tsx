"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";

/**
 * "Share to Slack" section of the share dialog.
 * Channel picking + posting is wired up once a Slack workspace is connected
 * (see the Slack integration milestone) — until then this renders the
 * appropriate connect/enable states so the button is never "broken".
 */
export function ShareToSlackSection({
  doc,
  workspace,
  slack,
  isAdmin,
}: {
  doc: { id: string; workspaceId: string };
  workspace: { id: string; isPersonal: boolean };
  slack: { configured: boolean; connected: boolean; teamName: string | null };
  isAdmin: boolean;
}) {
  void doc;
  if (workspace.isPersonal) return null;

  if (!slack.configured) {
    return (
      <section
        aria-label="Share to Slack"
        className="rounded-md border border-dashed border-[var(--border)] p-3"
      >
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)]">
          <MessageSquare className="h-4 w-4" />
          Share to Slack
        </h3>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          Slack isn’t configured for this deployment. See the README to set up
          the Slack app.
        </p>
      </section>
    );
  }

  if (!slack.connected) {
    return (
      <section
        aria-label="Share to Slack"
        className="rounded-md border border-[var(--border)] p-3"
      >
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
          Share to Slack
        </h3>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {isAdmin ? (
            <>
              Connect your Slack workspace to share pages directly into
              channels.{" "}
              <Link
                href={`/app/${workspace.id}/settings#slack`}
                className="font-medium text-[var(--primary)] hover:underline"
              >
                Connect Slack →
              </Link>
            </>
          ) : (
            "Ask a workspace admin to connect Slack in settings to share pages into channels."
          )}
        </p>
      </section>
    );
  }

  // Connected — the interactive picker is implemented with the Slack
  // integration milestone (replaced by the full component).
  return null;
}
