"use client";

import { Loader2Icon, Music2Icon } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignInButton() {
  const [isPending, setIsPending] = useState(false);

  async function handleSignIn() {
    try {
      setIsPending(true);

      await authClient.signIn.social({
        provider: "spotify",
        callbackURL: "/dashboard",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button disabled={isPending} onClick={handleSignIn} size="lg">
      {isPending ? (
        <Loader2Icon data-icon="inline-start" className="animate-spin" />
      ) : (
        <Music2Icon data-icon="inline-start" />
      )}
      Continue with Spotify
    </Button>
  );
}
