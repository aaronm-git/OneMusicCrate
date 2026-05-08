import {
  ArrowRightIcon,
  ArrowRightLeftIcon,
  Disc3Icon,
  ScanSearchIcon,
} from "lucide-react";
import Image from "next/image";

import { SignInButton } from "@/components/auth/sign-in-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Disc3Icon,
    title: "One collection, any player",
    description:
      "Your tracks, playlists, and saves live in one place — switch streaming services without losing what you've built.",
  },
  {
    icon: ScanSearchIcon,
    title: "Clean before you move",
    description:
      "Catch remasters, clean edits, and deluxe duplicates before they multiply across every platform you touch.",
  },
  {
    icon: ArrowRightLeftIcon,
    title: "Leave when it's time",
    description:
      "Better catalog? Better price? Take your entire library with you instead of starting over.",
  },
] as const;

const steps = [
  {
    step: "01",
    title: "Connect Spotify",
    description: "Link your account and pull in what you already have.",
  },
  {
    step: "02",
    title: "Import your library",
    description: "Tracks, playlists, albums — everything comes with you.",
  },
  {
    step: "03",
    title: "Resolve duplicates",
    description:
      "Review remasters, re-releases, and double-saves before they spread.",
  },
  {
    step: "04",
    title: "Switch when ready",
    description: "Export your clean library to the next service in minutes.",
  },
] as const;

const faqs = [
  {
    id: "lock-in",
    question: "Am I locked into one streaming service?",
    answer:
      "No. That's the whole point. Your crate is portable by design — switch providers whenever the value shifts.",
  },
  {
    id: "duplicates",
    question: "What kind of duplicates does it find?",
    answer:
      "Remasters, radio edits, deluxe tracks, clean versions, and accidental double-saves. You review each one before anything changes.",
  },
  {
    id: "services",
    question: "Which services are supported right now?",
    answer:
      "Spotify is live today. Apple Music and Tidal are next in the pipeline.",
  },
  {
    id: "manual",
    question: "Can't I just rebuild playlists by hand?",
    answer:
      "You can try. But manual rebuilding is slow, error-prone, and most people abandon it halfway through. A portable crate means your curation compounds instead of resetting every time you switch.",
  },
] as const;

function SectionDivider() {
  return (
    <div
      className="mx-auto h-px w-full max-w-xs bg-gradient-to-r from-transparent via-border to-transparent"
      aria-hidden
    />
  );
}

export function LandingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-col items-center gap-6 px-4 pt-28 pb-20 text-center sm:px-6 sm:pt-36 sm:pb-28 lg:pt-44 lg:pb-36">
        <Image
          src="/omc-logo.svg"
          alt="OneMusicCrate"
          width={80}
          height={80}
          className="size-20 animate-fade-in-up"
          priority
        />

        <Badge variant="outline" className="animate-fade-in-up">
          Spotify live · Apple Music & Tidal next
        </Badge>

        <h1 className="max-w-4xl font-display text-4xl leading-[1.08] tracking-tight text-balance animate-fade-in-up [animation-delay:80ms] sm:text-5xl lg:text-7xl">
          Your music collection shouldn&rsquo;t be held hostage.
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground text-balance animate-fade-in-up [animation-delay:160ms]">
          Import your Spotify library, clean up the duplicate mess, and keep
          everything portable. When a better service shows up, you&rsquo;re
          ready to move&thinsp;&mdash;&thinsp;not rebuild.
        </p>

        <div className="flex flex-wrap justify-center gap-3 animate-fade-in-up [animation-delay:240ms]">
          <a
            className={cn(
              buttonVariants({ size: "lg" }),
              "rounded-full px-6"
            )}
            href="#signin"
          >
            Connect Spotify
            <ArrowRightIcon className="ml-1 size-4" />
          </a>
          <a
            className={cn(
              buttonVariants({ size: "lg", variant: "ghost" }),
              "rounded-full px-6"
            )}
            href="#features"
          >
            See how it works
          </a>
        </div>
      </section>

      <SectionDivider />

      <section
        className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32"
        id="features"
      >
        <p className="mb-10 text-center font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase sm:mb-14">
          Why OneMusicCrate
        </p>

        <div className="grid gap-10 sm:grid-cols-3 sm:gap-8 lg:gap-12">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex flex-col gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <SectionDivider />

      <section className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <p className="mb-4 text-center font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
          How it works
        </p>
        <h2 className="mx-auto mb-12 max-w-xl text-center text-3xl font-semibold tracking-tight text-balance sm:mb-16 sm:text-4xl">
          Four steps to a portable library.
        </h2>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {steps.map((step) => (
            <div key={step.step} className="flex flex-col gap-2">
              <span className="font-mono text-sm font-semibold text-primary">
                {step.step}
              </span>
              <h3 className="text-base font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      <section
        className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-28 lg:py-32"
        id="signin"
      >
        <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
          Your next switch starts here.
        </h2>
        <p className="max-w-md text-muted-foreground text-balance">
          Connect Spotify, clean up your library, and stop dreading the day you
          need to move.
        </p>

        <div className="w-full rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
          <SignInButton />
        </div>
      </section>

      <SectionDivider />

      <section className="mx-auto w-full max-w-2xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <p className="mb-10 text-center font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase sm:mb-14">
          Questions
        </p>

        <Accordion>
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger className="text-left font-semibold hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </main>
  );
}
