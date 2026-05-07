"use client";

import { KeyRoundIcon, Loader2Icon, MailIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function SpotifyMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      preserveAspectRatio="xMidYMid"
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M128 0C57.308 0 0 57.309 0 128c0 70.696 57.309 128 128 128 70.697 0 128-57.304 128-128C256 57.314 198.697.007 127.998.007l.001-.006Zm58.699 184.614c-2.293 3.76-7.215 4.952-10.975 2.644-30.053-18.357-67.885-22.515-112.44-12.335a7.981 7.981 0 0 1-9.552-6.007 7.968 7.968 0 0 1 6-9.553c48.76-11.14 90.583-6.344 124.323 14.276 3.76 2.308 4.952 7.215 2.644 10.975Zm15.667-34.853c-2.89 4.695-9.034 6.178-13.726 3.289-34.406-21.148-86.853-27.273-127.548-14.92-5.278 1.594-10.852-1.38-12.454-6.649-1.59-5.278 1.386-10.842 6.655-12.446 46.485-14.106 104.275-7.273 143.787 17.007 4.692 2.89 6.175 9.034 3.286 13.72v-.001Zm1.345-36.293C162.457 88.964 94.394 86.71 55.007 98.666c-6.325 1.918-13.014-1.653-14.93-7.978-1.917-6.328 1.65-13.012 7.98-14.935C93.27 62.027 168.434 64.68 215.929 92.876c5.702 3.376 7.566 10.724 4.188 16.405-3.362 5.69-10.73 7.565-16.4 4.187h-.006Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SignInButton() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "spotify" | "email" | "password" | null
  >(null);

  async function handleSpotifySignIn() {
    try {
      setPendingAction("spotify");

      await authClient.signIn.social({
        provider: "spotify",
        callbackURL: "/dashboard",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }

    try {
      setPendingAction("email");
      const { error } = await authClient.signIn.magicLink({
        callbackURL: "/dashboard",
        email: email.trim(),
      });

      if (error) {
        throw new Error(error.message ?? "Unable to send magic link.");
      }

      toast.success("Magic link sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send magic link.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePasswordSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Enter your email and password.");
      return;
    }

    try {
      setPendingAction("password");
      const { error } = await authClient.signIn.email({
        callbackURL: "/dashboard",
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(error.message ?? "Unable to sign in.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        className="h-12 rounded-full bg-primary text-base font-bold tracking-wide text-primary-foreground transition-colors hover:bg-[var(--color-brand-green-bright)]"
        disabled={Boolean(pendingAction)}
        onClick={handleSpotifySignIn}
        size="lg"
      >
        {pendingAction === "spotify" ? (
          <Loader2Icon data-icon="inline-start" className="animate-spin" />
        ) : (
          <SpotifyMark className="size-5" data-icon="inline-start" />
        )}
        Continue with Spotify
      </Button>

      <form className="flex flex-col gap-3" onSubmit={handlePasswordSignIn}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Optional if using a magic link"
            type="password"
            value={password}
          />
        </div>
        <Button disabled={Boolean(pendingAction)} type="submit" variant="secondary">
          {pendingAction === "password" ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <KeyRoundIcon data-icon="inline-start" />
          )}
          Sign in with password
        </Button>
      </form>

      <form className="flex flex-col gap-3" onSubmit={handleMagicLink}>
        <Button disabled={Boolean(pendingAction)} type="submit" variant="outline">
          {pendingAction === "email" ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <MailIcon data-icon="inline-start" />
          )}
          Send magic link
        </Button>
      </form>
    </div>
  );
}
