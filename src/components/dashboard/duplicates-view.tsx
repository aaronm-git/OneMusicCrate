"use client";

import {
  Disc3Icon,
  Loader2Icon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TrackTableTrackCell } from "@/components/dashboard/track-table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatDuration, formatRelativeDate } from "@/lib/format";
import type {
  DuplicateCleanupSelection,
  DuplicateGroupView,
  ServiceDuplicatesPayload,
} from "@/lib/music-services";

type DuplicatesViewProps = {
  cleanupPending: boolean;
  isLoading: boolean;
  onConfirmCleanup: (groups: DuplicateCleanupSelection[]) => void;
  payload: ServiceDuplicatesPayload | undefined;
  serviceName: string;
};

function buildCleanupSelections(
  groups: DuplicateGroupView[],
  selectedKeeps: Record<string, string>
) {
  return groups
    .map((group) => {
      const keepProviderTrackId =
        selectedKeeps[group.id] ?? group.recommendedKeepProviderTrackId;

      return {
        keepProviderTrackId,
        removeProviderTrackIds: group.tracks
          .filter((track) => track.providerTrackId !== keepProviderTrackId)
          .map((track) => track.providerTrackId),
      };
    })
    .filter((group) => group.removeProviderTrackIds.length > 0);
}

export function DuplicatesView({
  cleanupPending,
  isLoading,
  onConfirmCleanup,
  payload,
  serviceName,
}: DuplicatesViewProps) {
  const [selectedKeeps, setSelectedKeeps] = useState<Record<string, string>>({});
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (!payload) {
      return;
    }

    setSelectedKeeps(
      Object.fromEntries(
        payload.groups.map((group) => [
          group.id,
          group.recommendedKeepProviderTrackId,
        ])
      )
    );
  }, [payload]);

  const groups = payload?.groups ?? [];
  const cleanupSelections = useMemo(
    () => buildCleanupSelections(groups, selectedKeeps),
    [groups, selectedKeeps]
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
              Each group starts with a recommended keep track. Change the keep selection anywhere before cleanup.
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
            const selectedKeep =
              selectedKeeps[group.id] ?? group.recommendedKeepProviderTrackId;

            return (
              <AccordionItem className="px-4 sm:px-5" key={group.id} value={group.id}>
                <AccordionTrigger className="gap-4 py-4 hover:no-underline">
                  <div className="flex min-w-0 flex-1 flex-col gap-2 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{group.title}</span>
                      <Badge className="rounded-full" variant="secondary">
                        {group.duplicateCount} versions
                      </Badge>
                      <Badge className="rounded-full" variant="outline">
                        Recommended keep ready
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {group.primaryArtist}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <RadioGroup
                    className="gap-3"
                    onValueChange={(value) =>
                      setSelectedKeeps((current) => ({
                        ...current,
                        [group.id]: value,
                      }))
                    }
                    value={selectedKeep}
                  >
                    {group.tracks.map((track) => {
                      const radioId = `${group.id}-${track.providerTrackId}`;
                      const isSelectedKeep =
                        selectedKeep === track.providerTrackId;

                      return (
                        <div
                          className="grid gap-3 rounded-lg border border-border/60 bg-background/80 p-4 lg:grid-cols-[minmax(0,1fr)_14rem_8rem]"
                          key={track.providerTrackId}
                        >
                          <div className="flex min-w-0 flex-col gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <RadioGroupItem id={radioId} value={track.providerTrackId} />
                              <div className="min-w-0 flex-1">
                                <TrackTableTrackCell
                                  subtitle={
                                    <>
                                      {track.artists.map((artist) => artist.name).join(", ")}
                                      <span className="mx-1.5">·</span>
                                      {formatDuration(track.durationMs)}
                                    </>
                                  }
                                  track={track}
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pl-7">
                              <Badge className="rounded-full" variant={isSelectedKeep ? "default" : "secondary"}>
                                {isSelectedKeep ? "Keeping" : "Will remove"}
                              </Badge>
                              {track.isRecommendedKeep ? (
                                <Badge className="rounded-full" variant="outline">
                                  Recommended
                                </Badge>
                              ) : null}
                              {track.versionLabel ? (
                                <Badge className="rounded-full" variant="secondary">
                                  {track.versionLabel}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col justify-between gap-2 pl-7 lg:pl-0">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Album
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm">{track.album}</p>
                            </div>
                            <Label className="text-sm text-muted-foreground" htmlFor={radioId}>
                              Keep this version
                            </Label>
                          </div>
                          <div className="flex flex-col justify-between gap-2 pl-7 text-sm lg:pl-0">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Saved
                              </p>
                              <p className="mt-1">{formatRelativeDate(track.savedAt)}</p>
                            </div>
                            <p className="text-muted-foreground">
                              {track.syncStatus === "synced" ? "Cached locally" : "Needs sync"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove duplicate tracks</DialogTitle>
            <DialogDescription>
              This will remove {selectedRemovalCount} duplicate
              {selectedRemovalCount === 1 ? "" : "s"} across {cleanupSelections.length} group
              {cleanupSelections.length === 1 ? "" : "s"} from your {serviceName} saved library.
            </DialogDescription>
          </DialogHeader>
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
            >
              {cleanupPending ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              Confirm cleanup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
