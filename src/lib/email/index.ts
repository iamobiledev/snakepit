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
