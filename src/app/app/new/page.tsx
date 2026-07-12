import { redirect } from "next/navigation";
import { requireVerifiedSession } from "@/lib/session";
import { actionCreateWorkspace } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brand } from "@/config/brand";

export default async function NewWorkspacePage() {
  await requireVerifiedSession();

  async function create(formData: FormData) {
    "use server";
    const workspace = await actionCreateWorkspace(formData);
    redirect(`/app/${workspace.id}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
        New workspace
      </h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        A shared home for your team&apos;s knowledge in {brand.name}. Everyone
        you invite can see every page inside it.
      </p>
      <form action={create} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Workspace name</Label>
          <Input
            id="name"
            name="name"
            required
            placeholder={brand.defaultWorkspaceName}
          />
        </div>
        <Button type="submit">Create</Button>
      </form>
    </div>
  );
}
