"use client";

import { Loader2Icon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    try {
      setIsPending(true);

      await authClient.signOut();

      router.push("/");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button disabled={isPending} onClick={handleSignOut} variant="outline">
      {isPending ? (
        <Loader2Icon data-icon="inline-start" className="animate-spin" />
      ) : (
        <LogOutIcon data-icon="inline-start" />
      )}
      Sign out
    </Button>
  );
}
