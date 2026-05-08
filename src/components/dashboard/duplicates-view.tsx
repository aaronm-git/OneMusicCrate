"use client";

import {
  AlertCircleIcon,
  Disc3Icon,
  ExternalLinkIcon,
  Loader2Icon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TrackTableTrackCell } from "@/components/dashboard/track-table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatDuration, formatRelativeDate } from "@/lib/format";
import type {
  DuplicateCleanupSelection,
  DuplicateGroupView,
  ServiceDuplicatesPayload,
} from "@/lib/music-services";
import { cn } from "@/lib/utils";

type DuplicatesViewProps = {
  activeTrackUri: string | null;
  cleanupPending: boolean;
  isActiveTrackPlaying: boolean;
  isLoading: boolean;
  isPlaybackEnabled: boolean;
  onConfirmCleanup: (groups: DuplicateCleanupSelection[]) => void;
  onTogglePlayback: (track: DuplicateGroupView["tracks"][number]) => Promise<void> | void;
  pendingPlaybackTrackUri: string | null;
  payload: ServiceDuplicatesPayload | undefined;
  serviceName: string;
};

const releaseDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const releaseMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

function formatReleaseLabel(track: DuplicateGroupView["tracks"][number]) {
  if (!track.releaseDate) {
    return null;
  }

  if (track.releaseDatePrecision === "year") {
    return `Released ${track.releaseDate}`;
  }

  if (track.releaseDatePrecision === "month") {
    const date = new Date(`${track.releaseDate}-01T00:00:00.000Z`);

    return Number.isNaN(date.getTime())
      ? `Released ${track.releaseDate}`
      : `Released ${releaseMonthFormatter.format(date)}`;
  }

  const date = new Date(`${track.releaseDate}T00:00:00.000Z`);

  return Number.isNaN(date.getTime())
    ? `Released ${track.releaseDate}`
    : `Released ${releaseDateFormatter.format(date)}`;
}

function buildCleanupSelections(
  groups: DuplicateGroupView[],
  keptTrackIdsByGroup: Record<string, string[]>
) {
  return groups
    .map((group) => {
      const keptTrackIds = new Set(
        keptTrackIdsByGroup[group.id]?.length
          ? keptTrackIdsByGroup[group.id]
          : [group.recommendedKeepProviderTrackId]
      );
      const keepProviderTrackId =
        group.tracks.find((track) => keptTrackIds.has(track.providerTrackId))
          ?.providerTrackId ?? group.recommendedKeepProviderTrackId;

      return {
        keepProviderTrackId,
        removeProviderTrackIds: group.tracks
          .filter((track) => !keptTrackIds.has(track.providerTrackId))
          .map((track) => track.providerTrackId),
      };
    })
    .filter((group) => group.removeProviderTrackIds.length > 0);
}

export function DuplicatesView({
  activeTrackUri,
  cleanupPending,
  isActiveTrackPlaying,
  isLoading,
  isPlaybackEnabled,
  onConfirmCleanup,
  onTogglePlayback,
  pendingPlaybackTrackUri,
  payload,
  serviceName,
}: DuplicatesViewProps) {
  const [keptTrackIdsByGroup, setKeptTrackIdsByGroup] = useState<
    Record<string, string[]>
  >({});
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (!payload) {
      return;
    }

    setKeptTrackIdsByGroup(
      Object.fromEntries(
        payload.groups.map((group) => [
          group.id,
          [group.recommendedKeepProviderTrackId],
        ])
      )
    );
  }, [payload]);

  const groups = payload?.groups ?? [];
  const cleanupSelections = useMemo(
    () => buildCleanupSelections(groups, keptTrackIdsByGroup),
    [groups, keptTrackIdsByGroup]
  );
  const selectedRemovalCount = cleanupSelections.reduce(
    (total, group) => total + group.removeProviderTrackIds.length,
    0
  );

  if (isLoading && !payload) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading duplicates
        </div>
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  if (payload.service.connectionStatus === "coming-soon") {
    return (
      <Empty className="rounded-lg border-border/50 bg-card/40">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SparklesIcon />
          </EmptyMedia>
          <EmptyTitle>{serviceName} duplicates are not available yet</EmptyTitle>
          <EmptyDescription>
            This screen will light up when {serviceName} syncing is supported.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (payload.service.connectionStatus !== "connected") {
    return (
      <Empty className="rounded-lg border-border/50 bg-card/40">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Disc3Icon />
          </EmptyMedia>
          <EmptyTitle>Connect {serviceName} first</EmptyTitle>
          <EmptyDescription>
            Duplicates are detected from your synced saved library after the service is connected.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!groups.length) {
    return (
      <Empty className="rounded-lg border-border/50 bg-card/40">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SparklesIcon />
          </EmptyMedia>
          <EmptyTitle>No duplicate tracks found</EmptyTitle>
          <EmptyDescription>
            Your synced {serviceName} saved library does not currently contain removable duplicates.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Duplicates</CardTitle>
              <CardDescription>
                Review alternate saves and keep the best version in your {serviceName} library.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full" variant="secondary">
                {payload.summary.groupCount} groups
              </Badge>
              <Badge className="rounded-full" variant="secondary">
                {selectedRemovalCount} removable
              </Badge>
              <Badge className="rounded-full" variant="outline">
                {payload.summary.trackCount} tracks reviewed
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Each group starts with a recommended keep track. Keep as many versions as you want, then remove only the unchecked ones.
            </p>
            <Button
              disabled={!selectedRemovalCount || cleanupPending}
              onClick={() => setIsConfirmDialogOpen(true)}
            >
              {cleanupPending ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              Remove duplicates
            </Button>
          </CardContent>
        </Card>

        <Accordion className="rounded-lg border border-border/60 bg-card/40" multiple>
          {groups.map((group) => {
            const keptTrackIds = new Set(
              keptTrackIdsByGroup[group.id]?.length
                ? keptTrackIdsByGroup[group.id]
                : [group.recommendedKeepProviderTrackId]
            );
            const keptCount = keptTrackIds.size;

            return (
              <AccordionItem className="px-4 sm:px-5" key={group.id} value={group.id}>
                <AccordionTrigger className="gap-3 py-3 hover:no-underline">
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="truncate font-semibold">{group.title}</span>
                    <span className="hidden text-sm text-muted-foreground sm:inline" aria-hidden>·</span>
                    <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                      {group.primaryArtist}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <Badge className="rounded-full" variant="secondary">
                        {group.duplicateCount} versions
                      </Badge>
                      <Badge className="rounded-full" variant="outline">
                        {keptCount} keeping
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 [&_p:not(:last-child)]:mb-0">
                  <div className="flex flex-col gap-2">
                    {group.tracks.map((track) => {
                      const checkboxId = `${group.id}-${track.providerTrackId}`;
                      const isSelectedKeep = keptTrackIds.has(track.providerTrackId);
                      const releaseLabel = formatReleaseLabel(track);

                      return (
                        <div
                          className={cn(
                            "group/track-row flex items-start gap-3 rounded-lg border p-3 transition-colors",
                            isSelectedKeep
                              ? "border-primary/25 bg-primary/5"
                              : "border-border/40"
                          )}
                          key={track.providerTrackId}
                        >
                          <Checkbox
                            checked={isSelectedKeep}
                            className="mt-2.5"
                            id={checkboxId}
                            onCheckedChange={(checked) => {
                              setKeptTrackIdsByGroup((current) => {
                                const existing =
                                  current[group.id]?.length
                                    ? current[group.id]
                                    : [group.recommendedKeepProviderTrackId];
                                const next = new Set(existing);

                                if (checked) {
                                  next.add(track.providerTrackId);
                                } else {
                                  next.delete(track.providerTrackId);
                                  if (next.size === 0) {
                                    next.add(group.tracks[0].providerTrackId);
                                  }
                                }

                                return {
                                  ...current,
                                  [group.id]: Array.from(next),
                                };
                              });
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <TrackTableTrackCell
                                playback={{
                                  disabled: !isPlaybackEnabled,
                                  isBusy:
                                    pendingPlaybackTrackUri === track.uri,
                                  isCurrent: activeTrackUri === track.uri,
                                  isPlaying:
                                    activeTrackUri === track.uri &&
                                    isActiveTrackPlaying,
                                  onToggle: () => void onTogglePlayback(track),
                                }}
                                subtitle={
                                  <>
                                    {track.artists.map((artist) => artist.name).join(", ")}
                                    <span className="mx-1.5">·</span>
                                    {formatDuration(track.durationMs)}
                                  </>
                                }
                                track={track}
                              />
                              <div className="flex shrink-0 items-center gap-1.5">
                                <Badge
                                  className="rounded-full"
                                  variant={isSelectedKeep ? "default" : "secondary"}
                                >
                                  {isSelectedKeep ? "Keep" : "Remove"}
                                </Badge>
                                {track.isRecommendedKeep ? (
                                  <span
                                    className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary"
                                    title="Recommended"
                                  >
                                    <SparklesIcon className="size-3" />
                                  </span>
                                ) : null}
                                {track.spotifyUrl ? (
                                  <a
                                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                                    href={track.spotifyUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                    title="Open in Spotify"
                                  >
                                    <ExternalLinkIcon className="size-3.5" />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-2 grid gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:mt-1 sm:grid-cols-[1fr_auto] sm:pl-[calc(44px+0.75rem)]">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="max-w-48 truncate">{track.album}</span>
                                {releaseLabel ? (
                                  <>
                                    <span className="text-border" aria-hidden>·</span>
                                    <span>{releaseLabel}</span>
                                  </>
                                ) : null}
                                {track.albumType ? (
                                  <>
                                    <span className="text-border" aria-hidden>·</span>
                                    <span className="capitalize">{track.albumType}</span>
                                  </>
                                ) : null}
                                {track.discNumber ? (
                                  <>
                                    <span className="text-border" aria-hidden>·</span>
                                    <span>Disc {track.discNumber}</span>
                                  </>
                                ) : null}
                                {track.trackNumber ? (
                                  <>
                                    <span className="text-border" aria-hidden>·</span>
                                    <span>Track {track.trackNumber}</span>
                                  </>
                                ) : null}
                                {track.versionLabel ? (
                                  <>
                                    <span className="text-border" aria-hidden>·</span>
                                    <span>{track.versionLabel}</span>
                                  </>
                                ) : null}
                                {track.explicit ? (
                                  <Badge className="rounded px-1 py-0 text-[0.6rem] leading-tight" variant="secondary">
                                    E
                                  </Badge>
                                ) : null}
                                {track.isPlayable === false ? (
                                  <>
                                    <span className="text-border" aria-hidden>·</span>
                                    <span className="text-destructive">Unavailable</span>
                                  </>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-3">
                                {track.popularity !== null ? (
                                  <span className="inline-flex items-center gap-1.5" title={`Popularity ${track.popularity}/100`}>
                                    <span className="inline-block h-1 w-12 overflow-hidden rounded-full bg-muted">
                                      <span
                                        className="block h-full rounded-full bg-primary transition-all"
                                        style={{ width: `${track.popularity}%` }}
                                      />
                                    </span>
                                    <span className="tabular-nums">{track.popularity}</span>
                                  </span>
                                ) : null}
                                <span>Saved {formatRelativeDate(track.savedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove unchecked tracks from {serviceName}</DialogTitle>
            <DialogDescription>
              You are about to remove {selectedRemovalCount} track
              {selectedRemovalCount === 1 ? "" : "s"} across {cleanupSelections.length} song
              {cleanupSelections.length === 1 ? "" : "s"} from your {serviceName} saved library.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>This action changes your {serviceName} library.</AlertTitle>
            <AlertDescription>
              The unchecked tracks will be removed from your saved songs in {serviceName}. This is a destructive action and you cannot undo it from OneMusicCrate.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button
              disabled={cleanupPending}
              onClick={() => setIsConfirmDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={cleanupPending || !cleanupSelections.length}
              onClick={() => {
                onConfirmCleanup(cleanupSelections);
                setIsConfirmDialogOpen(false);
              }}
              variant="destructive"
            >
              {cleanupPending ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              Remove tracks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
