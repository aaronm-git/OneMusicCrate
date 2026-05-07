import { redirect } from "next/navigation";
import { Disc3Icon, SparklesIcon } from "lucide-react";

import { SignInButton } from "@/components/auth/sign-in-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getServerSession } from "@/lib/session";

export default async function Home() {
  const session = await getServerSession();

  if (session) {
    redirect("/dashboard");
  }

  const callbackBase = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <main className="flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <section className="max-w-2xl">
          <Badge className="mb-4">Spotify-first local setup</Badge>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_32px_color-mix(in_oklch,var(--color-primary)_30%,transparent)]">
              <Disc3Icon className="size-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">OneMusicCrate</p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Music streaming synchronization with a working Spotify control room
              </h1>
            </div>
          </div>
          <p className="max-w-xl text-lg text-muted-foreground">
            Sign in with Spotify or email to load the cached library, manage playlists, and route playback into the browser-based Spotify player.
          </p>
        </section>

        <Card className="w-full max-w-md border-primary/20 bg-card/90 shadow-2xl shadow-black/30">
          <CardContent className="flex flex-col gap-6 pt-2">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/15 p-2 text-primary">
                <SparklesIcon className="size-5" />
              </div>
              <div>
                <p className="font-medium">A music streaming synchronization and library management tool</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Better Auth handles Spotify, password, and magic-link login. The dashboard reads your Docker-backed PostgreSQL instance first.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <SignInButton />
              <p className="text-sm text-muted-foreground">
                Local callback:{" "}
                <span className="font-mono text-foreground">{callbackBase}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
