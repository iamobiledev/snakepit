import "server-only";
import { brand } from "@/config/brand";
import { getAppUrl, getServerEnv } from "@/env/server";
import { ConsoleEmailProvider } from "./types";
import { ResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const env = getServerEnv();
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    cached = new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
  } else {
    cached = new ConsoleEmailProvider();
  }
  return cached;
}

export async function sendVerificationEmail(opts: {
  to: string;
  url: string;
  name?: string;
}) {
  const provider = getEmailProvider();
  await provider.send({
    to: opts.to,
    subject: `Verify your email for ${brand.name}`,
    html: `<p>Hi${opts.name ? ` ${opts.name}` : ""},</p>
<p>Please verify your email to finish setting up ${brand.name}:</p>
<p><a href="${opts.url}">Verify email</a></p>
<p>If you did not create an account, you can ignore this message.</p>`,
    text: `Verify your email: ${opts.url}`,
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  url: string;
}) {
  const provider = getEmailProvider();
  await provider.send({
    to: opts.to,
    subject: `Reset your ${brand.name} password`,
    html: `<p>Reset your password:</p>
<p><a href="${opts.url}">Reset password</a></p>
<p>If you did not request this, you can ignore this message.</p>`,
    text: `Reset your password: ${opts.url}`,
  });
}

export async function sendWorkspaceJoinedEmail(opts: {
  to: string;
  memberName: string;
  workspaceName: string;
  workspaceUrl: string;
}) {
  const provider = getEmailProvider();
  await provider.send({
    to: opts.to,
    subject: `You now have access to ${opts.workspaceName} on ${brand.name}`,
    html: `<p>Hi ${opts.memberName},</p>
<p>You've joined <strong>${opts.workspaceName}</strong> on ${brand.name}. Every page in the workspace is now available to you.</p>
<p><a href="${opts.workspaceUrl}">Open ${opts.workspaceName}</a></p>
<p>${brand.tagline}</p>`,
    text: `You've joined ${opts.workspaceName} on ${brand.name}: ${opts.workspaceUrl}`,
  });
}

export async function sendInvitationAcceptedEmail(opts: {
  to: string;
  inviterName: string;
  memberName: string;
  memberEmail: string;
  workspaceName: string;
  workspaceUrl: string;
}) {
  const provider = getEmailProvider();
  await provider.send({
    to: opts.to,
    subject: `${opts.memberName} joined ${opts.workspaceName}`,
    html: `<p>Hi ${opts.inviterName},</p>
<p><strong>${opts.memberName}</strong> (${opts.memberEmail}) accepted your invitation and joined <strong>${opts.workspaceName}</strong>.</p>
<p><a href="${opts.workspaceUrl}">Open ${opts.workspaceName}</a></p>`,
    text: `${opts.memberName} (${opts.memberEmail}) joined ${opts.workspaceName}: ${opts.workspaceUrl}`,
  });
}

export async function sendDocumentActivityEmail(opts: {
  to: string;
  recipientName: string;
  actorName: string;
  documentTitle: string;
  workspaceName: string;
  documentUrl: string;
}) {
  const provider = getEmailProvider();
  await provider.send({
    to: opts.to,
    subject: `${opts.actorName} made changes to "${opts.documentTitle}"`,
    html: `<p>Hi ${opts.recipientName},</p>
<p><strong>${opts.actorName}</strong> made changes to <strong>${opts.documentTitle}</strong> in <strong>${opts.workspaceName}</strong>.</p>
<p><a href="${opts.documentUrl}">Open the page</a> to see what changed (the page's History shows every edit).</p>
<p style="color:#6b6458;font-size:12px">You get at most one email per page every few hours. Turn these off in Settings → Notifications.</p>`,
    text: `${opts.actorName} made changes to "${opts.documentTitle}" in ${opts.workspaceName}: ${opts.documentUrl}`,
  });
}

export async function sendAccessRequestEmail(opts: {
  to: string | string[];
  requesterName: string;
  requesterEmail: string;
  documentTitle: string;
  workspaceName: string;
  settingsUrl: string;
}) {
  const provider = getEmailProvider();
  await provider.send({
    to: opts.to,
    subject: `${opts.requesterName} requested access to "${opts.documentTitle}"`,
    html: `<p><strong>${opts.requesterName}</strong> (${opts.requesterEmail}) requested access to <strong>${opts.documentTitle}</strong> in <strong>${opts.workspaceName}</strong> on ${brand.name}.</p>
<p>To give them access, invite them to the workspace:</p>
<p><a href="${opts.settingsUrl}">Open workspace settings</a></p>`,
    text: `${opts.requesterName} (${opts.requesterEmail}) requested access to "${opts.documentTitle}" in ${opts.workspaceName}. Invite them: ${opts.settingsUrl}`,
  });
}

const LEVEL_PHRASE: Record<string, string> = {
  full_access: "full access",
  edit: "edit access",
  view: "view access",
};

/** An existing user was given direct access to a page. */
export async function sendDocumentSharedEmail(opts: {
  to: string;
  recipientName: string;
  sharerName: string;
  documentTitle: string;
  level: "full_access" | "edit" | "view";
  documentUrl: string;
}) {
  const provider = getEmailProvider();
  const levelPhrase = LEVEL_PHRASE[opts.level] ?? "access";
  await provider.send({
    to: opts.to,
    subject: `${opts.sharerName} shared "${opts.documentTitle}" with you`,
    html: `<p>Hi ${opts.recipientName},</p>
<p><strong>${opts.sharerName}</strong> shared <strong>${opts.documentTitle}</strong> with you on ${brand.name} (${levelPhrase}).</p>
<p><a href="${opts.documentUrl}">Open the page</a></p>
<p>${brand.tagline}</p>`,
    text: `${opts.sharerName} shared "${opts.documentTitle}" with you (${levelPhrase}): ${opts.documentUrl}`,
  });
}

/** A page was shared with an email that has no account yet. */
export async function sendDocumentInvitationEmail(opts: {
  to: string;
  sharerName: string;
  documentTitle: string;
  token: string;
}) {
  const url = `${getAppUrl()}/invitations/${opts.token}`;
  const provider = getEmailProvider();
  await provider.send({
    to: opts.to,
    subject: `${opts.sharerName} shared "${opts.documentTitle}" with you on ${brand.name}`,
    html: `<p><strong>${opts.sharerName}</strong> shared <strong>${opts.documentTitle}</strong> with you on ${brand.name}.</p>
<p>Create a free account with this email address to open it:</p>
<p><a href="${url}">Open the invitation</a></p>
<p>${brand.tagline}</p>`,
    text: `${opts.sharerName} shared "${opts.documentTitle}" with you. Open the invitation: ${url}`,
  });
}

export async function sendWorkspaceInvitationEmail(opts: {
  to: string;
  workspaceName: string;
  inviterName: string;
  token: string;
}) {
  const url = `${getAppUrl()}/invitations/${opts.token}`;
  const provider = getEmailProvider();
  await provider.send({
    to: opts.to,
    subject: `You're invited to ${opts.workspaceName} on ${brand.name}`,
    html: `<p>${opts.inviterName} invited you to join <strong>${opts.workspaceName}</strong> on ${brand.name}.</p>
<p><a href="${url}">Accept invitation</a></p>
<p>${brand.tagline}</p>`,
    text: `Accept invitation: ${url}`,
  });
}
