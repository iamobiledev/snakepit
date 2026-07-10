import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  getDb,
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  user,
} from "@/db";
import {
  requireMembership,
  canInvite,
  canManageWorkspace,
} from "@/lib/permissions";
import { sendWorkspaceInvitationEmail } from "@/lib/email";
import { slugify } from "@/lib/utils";
import { brand } from "@/config/brand";

export async function createWorkspace(opts: {
  userId: string;
  name: string;
}) {
  const db = getDb();
  const id = nanoid();
  const base = slugify(opts.name) || "workspace";
  const slug = `${base}-${nanoid(6)}`;

  const [workspace] = await db
    .insert(workspaces)
    .values({
      id,
      name: opts.name.trim() || brand.defaultWorkspaceName,
      slug,
      createdById: opts.userId,
    })
    .returning();

  await db.insert(workspaceMembers).values({
    id: nanoid(),
    workspaceId: workspace.id,
    userId: opts.userId,
    role: "owner",
  });

  return workspace;
}

export async function inviteToWorkspace(opts: {
  userId: string;
  workspaceId: string;
  email: string;
  role?: "admin" | "member" | "guest";
}) {
  const membership = await requireMembership(
    opts.userId,
    opts.workspaceId,
    "admin",
  );
  if (!canInvite(membership.role)) throw new Error("FORBIDDEN");

  const db = getDb();
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, opts.workspaceId))
    .limit(1);
  if (!workspace) throw new Error("NOT_FOUND");

  const [inviter] = await db
    .select()
    .from(user)
    .where(eq(user.id, opts.userId))
    .limit(1);

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const [invitation] = await db
    .insert(workspaceInvitations)
    .values({
      id: nanoid(),
      workspaceId: opts.workspaceId,
      email: opts.email.toLowerCase().trim(),
      role: opts.role ?? "member",
      token,
      status: "pending",
      invitedById: opts.userId,
      expiresAt,
    })
    .returning();

  await sendWorkspaceInvitationEmail({
    to: invitation.email,
    workspaceName: workspace.name,
    inviterName: inviter?.name ?? "A teammate",
    token,
  });

  return invitation;
}

export async function acceptInvitation(opts: {
  userId: string;
  userEmail: string;
  token: string;
}) {
  const db = getDb();
  const [invitation] = await db
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.token, opts.token))
    .limit(1);

  if (!invitation) throw new Error("NOT_FOUND");
  if (invitation.status !== "pending") throw new Error("INVITATION_INACTIVE");
  if (invitation.expiresAt.getTime() < Date.now()) {
    await db
      .update(workspaceInvitations)
      .set({ status: "expired" })
      .where(eq(workspaceInvitations.id, invitation.id));
    throw new Error("INVITATION_EXPIRED");
  }
  if (invitation.email.toLowerCase() !== opts.userEmail.toLowerCase()) {
    throw new Error("EMAIL_MISMATCH");
  }

  const existing = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, invitation.workspaceId),
        eq(workspaceMembers.userId, opts.userId),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(workspaceMembers).values({
      id: nanoid(),
      workspaceId: invitation.workspaceId,
      userId: opts.userId,
      role: invitation.role === "owner" ? "admin" : invitation.role,
    });
  }

  await db
    .update(workspaceInvitations)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(workspaceInvitations.id, invitation.id));

  return invitation.workspaceId;
}

export async function expireOldInvitations() {
  const db = getDb();
  const result = await db
    .update(workspaceInvitations)
    .set({ status: "expired" })
    .where(
      and(
        eq(workspaceInvitations.status, "pending"),
        lt(workspaceInvitations.expiresAt, new Date()),
      ),
    )
    .returning({ id: workspaceInvitations.id });
  return result.length;
}

export async function pruneOldDocumentVersions(retainPerDocument = 50) {
  const { sql } = await import("drizzle-orm");
  const db = getDb();
  const result = await db.execute(sql`
    DELETE FROM document_versions
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY version DESC) AS rn
        FROM document_versions
      ) ranked
      WHERE rn > ${retainPerDocument}
    )
  `);
  return result;
}

export { canManageWorkspace };
