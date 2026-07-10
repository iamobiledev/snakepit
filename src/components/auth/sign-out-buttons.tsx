"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function SignOutButtons() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await signOut();
            router.push("/sign-in");
            router.refresh();
          });
        }}
      >
        Sign out
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            // Sign out current device, then revoke remaining sessions via API
            await fetch("/api/auth/revoke-sessions", {
              method: "POST",
              credentials: "include",
            }).catch(() => undefined);
            await signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push("/sign-in");
                },
              },
            });
            router.push("/sign-in");
            router.refresh();
          });
        }}
      >
        Sign out all devices
      </Button>
    </div>
  );
}
