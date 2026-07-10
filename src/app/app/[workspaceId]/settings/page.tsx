import { notFound } from "next/navigation";
import { requireVerifiedSession } from "@/lib/session";
import { listUserWorkspaces } from "@/lib/documents/service";
import { actionInviteMember } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await requireVerifiedSession();
  const workspaces = await listUserWorkspaces(session.user.id);
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) notFound();

  async function invite(formData: FormData) {
    "use server";
    formData.set("workspaceId", workspaceId);
    await actionInviteMember(formData);
  }

  return (
    <div className="mx-auto max-w-lg space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Workspace settings
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {workspace.name}
        </p>
      </div>

      <section>
        <h2 className="text-lg font-medium">Invite a teammate</h2>
        <form action={invite} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              defaultValue="member"
              className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="guest">Guest</option>
            </select>
          </div>
          <Button type="submit">Send invitation</Button>
        </form>
      </section>
    </div>
  );
}
