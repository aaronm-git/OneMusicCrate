"use client";

import {
  AudioLinesIcon,
  Disc3Icon,
  HeartIcon,
  LibraryBigIcon,
  ListMusicIcon,
  PlusIcon,
  RefreshCcwIcon,
  SparklesIcon,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { FooterPlayer } from "@/components/dashboard/footer-player";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCompactNumber, formatDuration, formatRelativeDate } from "@/lib/format";
import type {
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifyProfile,
  SpotifySavedTrack,
} from "@/lib/spotify-types";

type DashboardShellProps = {
  initialPlayback: SpotifyPlaybackState | null;
  notices: string[];
  playlists: SpotifyPlaylist[];
  profile: SpotifyProfile;
  savedTracks: SpotifySavedTrack[];
};

type PlaylistDraft = {
  name: string;
  description: string;
};

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(payload?.error ?? "Request failed.");
  }

  return (await response.json().catch(() => null)) as T;
}

export function DashboardShell({
  initialPlayback,
  notices,
  playlists: initialPlaylists,
  profile,
  savedTracks,
}: DashboardShellProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [browserDeviceId, setBrowserDeviceId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [trackForPlaylist, setTrackForPlaylist] = useState<SpotifySavedTrack | null>(null);
  const [playlistDraft, setPlaylistDraft] = useState<PlaylistDraft>({
    name: "",
    description: "",
  });
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [pendingPlaylistAction, setPendingPlaylistAction] = useState<string | null>(null);
  const activePlan = profile.product ? profile.product.toUpperCase() : "FREE";

  const metrics = useMemo(
    () => [
      {
        label: "Saved tracks",
        value: savedTracks.length,
        description: "Ready for playlist curation",
        icon: HeartIcon,
      },
      {
        label: "Playlists",
        value: playlists.length,
        description: "Available as crate targets",
        icon: ListMusicIcon,
      },
      {
        label: "Followers",
        value: profile.followers.total,
        description: "Loaded from your Spotify profile",
        icon: AudioLinesIcon,
      },
    ],
    [playlists.length, profile.followers.total, savedTracks.length]
  );

  function refreshDashboard() {
    startRefresh(() => {
      router.refresh();
    });
  }

  async function handleRemoveTrack(trackId: string) {
    try {
      setPendingTrackId(trackId);
      await postJson("/api/spotify/library", {
        trackId,
        shouldSave: false,
      });
      toast.success("Removed from your Spotify library.");
      refreshDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update your library.");
    } finally {
      setPendingTrackId(null);
    }
  }

  async function handleCreatePlaylist() {
    try {
      if (!playlistDraft.name.trim()) {
        toast.error("Give the new playlist a name first.");
        return;
      }

      setPendingPlaylistAction("create");
      const payload = await postJson<{ playlist: SpotifyPlaylist }>(
        "/api/spotify/playlists",
        playlistDraft
      );
      setPlaylists((current) => [payload.playlist, ...current]);
      setPlaylistDraft({ name: "", description: "" });
      setIsCreateDialogOpen(false);
      toast.success("Playlist created on Spotify.");
      refreshDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the playlist.");
    } finally {
      setPendingPlaylistAction(null);
    }
  }

  async function handleAddTrackToPlaylist(playlistId: string, trackUri: string) {
    try {
      setPendingPlaylistAction(playlistId);
      await postJson(`/api/spotify/playlists/${playlistId}/tracks`, {
        trackUri,
      });
      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                tracks: {
                  total: playlist.tracks.total + 1,
                },
              }
            : playlist
        )
      );
      setTrackForPlaylist(null);
      toast.success("Track added to the playlist.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add the track.");
    } finally {
      setPendingPlaylistAction(null);
    }
  }

  async function handlePlayTrack(trackUri: string) {
    try {
      await postJson("/api/spotify/player", {
        action: "play-track",
        deviceId: browserDeviceId,
        trackUri,
      });
      toast.success(
        browserDeviceId
          ? "Playing through the OneMusicCrate browser player."
          : "Sent to your active Spotify player."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start playback.");
    }
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_32px_color-mix(in_oklch,var(--color-primary)_28%,transparent)]">
                <Disc3Icon className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">OneMusicCrate</p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  A music streaming synchronization and library management tool
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Spotify linked</Badge>
              <Badge variant="secondary">{activePlan} account</Badge>
              <Badge variant="outline">
                {browserDeviceId ? "Browser device ready" : "Connect browser player for local playback"}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Card className="min-w-72 py-3">
              <CardContent className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarImage alt={profile.display_name ?? profile.email} src={profile.images[0]?.url} />
                  <AvatarFallback>
                    {(profile.display_name ?? profile.email).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {profile.display_name ?? "Spotify listener"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {profile.country} · {formatCompactNumber(profile.followers.total)} followers
                  </p>
                </div>
              </CardContent>
            </Card>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </header>

        {notices.length ? (
          <div className="flex flex-col gap-3">
            {notices.map((notice) => (
              <Alert key={notice}>
                <SparklesIcon />
                <AlertTitle>Spotify data loaded with a partial fallback</AlertTitle>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <Card key={metric.label}>
                <CardHeader>
                  <CardDescription>{metric.label}</CardDescription>
                  <CardAction>
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <Icon className="size-4" />
                    </div>
                  </CardAction>
                  <CardTitle className="text-3xl">{formatCompactNumber(metric.value)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{metric.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs className="gap-4" defaultValue="library">
          <TabsList variant="line">
            <TabsTrigger value="library">
              <LibraryBigIcon data-icon="inline-start" />
              Library
            </TabsTrigger>
            <TabsTrigger value="playlists">
              <ListMusicIcon data-icon="inline-start" />
              Playlists
            </TabsTrigger>
            <TabsTrigger value="sync">
              <RefreshCcwIcon data-icon="inline-start" />
              Sync
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library">
            <Card className="gap-0">
              <CardHeader className="border-b">
                <CardTitle>Saved tracks</CardTitle>
                <CardDescription>
                  Stream directly from your Spotify library, remove tracks you are done with, or add them into a new crate playlist.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {savedTracks.length ? (
                  <ScrollArea className="h-[540px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Track</TableHead>
                          <TableHead>Album</TableHead>
                          <TableHead>Saved</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {savedTracks.map((item) => (
                          <TableRow key={item.track.id}>
                            <TableCell className="whitespace-normal">
                              <div className="flex items-center gap-3">
                                <div className="relative size-12 overflow-hidden rounded-lg bg-muted">
                                  {item.track.album.images[0]?.url ? (
                                    <Image
                                      alt={item.track.album.name}
                                      className="object-cover"
                                      fill
                                      sizes="48px"
                                      src={item.track.album.images[0].url}
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{item.track.name}</p>
                                  <p className="truncate text-sm text-muted-foreground">
                                    {item.track.artists.map((artist) => artist.name).join(", ")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDuration(item.track.duration_ms)}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs whitespace-normal text-muted-foreground">
                              {item.track.album.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatRelativeDate(item.added_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  onClick={() => void handlePlayTrack(item.track.uri)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <AudioLinesIcon data-icon="inline-start" />
                                  Play
                                </Button>
                                <Button
                                  disabled={pendingTrackId === item.track.id}
                                  onClick={() => setTrackForPlaylist(item)}
                                  size="sm"
                                  variant="secondary"
                                >
                                  <PlusIcon data-icon="inline-start" />
                                  Add to playlist
                                </Button>
                                <Button
                                  disabled={pendingTrackId === item.track.id}
                                  onClick={() => void handleRemoveTrack(item.track.id)}
                                  size="sm"
                                  variant="ghost"
                                >
                                  <HeartIcon data-icon="inline-start" />
                                  Remove
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="px-4 pb-4">
                    <Empty className="border-border">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <LibraryBigIcon />
                        </EmptyMedia>
                        <EmptyTitle>No saved tracks yet</EmptyTitle>
                        <EmptyDescription>
                          Once Spotify returns saved tracks for this account, they will land here with playback and playlist actions.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="playlists">
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Playlist crates</CardTitle>
                  <CardDescription>
                    Create private crate playlists and route tracks into them directly from the library tab.
                  </CardDescription>
                  <CardAction>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                      <DialogTrigger render={<Button variant="secondary" />}>
                        <PlusIcon data-icon="inline-start" />
                        Create playlist
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create a new crate playlist</DialogTitle>
                          <DialogDescription>
                            This creates a private playlist in Spotify and keeps it available as a sync target inside OneMusicCrate.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                          <Input
                            onChange={(event) =>
                              setPlaylistDraft((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            placeholder="Late-night transfer queue"
                            value={playlistDraft.name}
                          />
                          <Input
                            onChange={(event) =>
                              setPlaylistDraft((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            placeholder="Optional description"
                            value={playlistDraft.description}
                          />
                        </div>
                        <DialogFooter>
                          <Button
                            disabled={pendingPlaylistAction === "create"}
                            onClick={() => void handleCreatePlaylist()}
                          >
                            <PlusIcon data-icon="inline-start" />
                            Create playlist
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {playlists.length ? (
                    playlists.map((playlist) => (
                      <Card className="bg-background/60 py-3" key={playlist.id} size="sm">
                        <CardContent className="flex flex-col gap-3">
                          <div className="flex items-start gap-3">
                            <div className="relative size-16 overflow-hidden rounded-xl bg-muted">
                              {playlist.images[0]?.url ? (
                                <Image
                                  alt={playlist.name}
                                  className="object-cover"
                                  fill
                                  sizes="64px"
                                  src={playlist.images[0].url}
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{playlist.name}</p>
                              <p className="line-clamp-2 text-sm text-muted-foreground">
                                {playlist.description || "Private Spotify crate ready for library sync and sequencing."}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">
                              {playlist.tracks.total} tracks
                            </Badge>
                            <Badge variant="outline">
                              {playlist.collaborative ? "Collaborative" : "Private"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="md:col-span-2">
                      <Empty className="border-border">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <ListMusicIcon />
                          </EmptyMedia>
                          <EmptyTitle>No playlists available</EmptyTitle>
                          <EmptyDescription>
                            Create the first Spotify crate and start routing tracks into it from your library.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Connected source</CardTitle>
                  <CardDescription>
                    The current v1 scope is Spotify-first. The sync layer is staged for more targets later.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="rounded-xl border border-border/80 bg-background/70 p-4">
                    <p className="font-medium">Spotify library</p>
                    <p className="text-sm text-muted-foreground">
                      Authenticated, readable, and writable.
                    </p>
                  </div>
                  <div className="rounded-xl border border-dashed border-border/80 bg-background/50 p-4">
                    <p className="font-medium">Future sync targets</p>
                    <p className="text-sm text-muted-foreground">
                      Cross-service synchronization is deferred, but the dashboard already frames playlists as crate destinations.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sync">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Source status</CardTitle>
                  <CardDescription>Spotify is the active source of truth.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge>Connected</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Crate workflow</CardTitle>
                  <CardDescription>
                    Save tracks, group them into playlists, then expand to multi-service sync later.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    This v1 dashboard focuses on auth, playback, library control, and playlist management without inventing sync rules yet.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Dashboard state</CardTitle>
                  <CardDescription>
                    {isRefreshing ? "Refreshing after a Spotify mutation." : "Ready for the next library or playback action."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">
                    {browserDeviceId ? "Browser player online" : "Waiting for browser player"}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={Boolean(trackForPlaylist)}
        onOpenChange={(open) => {
          if (!open) {
            setTrackForPlaylist(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add track to a crate playlist</DialogTitle>
            <DialogDescription>
              {trackForPlaylist
                ? `Choose a playlist for ${trackForPlaylist.track.name}.`
                : "Choose a playlist."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-64">
            <div className="flex flex-col gap-2">
              {playlists.map((playlist) => (
                <Button
                  disabled={!trackForPlaylist || pendingPlaylistAction === playlist.id}
                  key={playlist.id}
                  onClick={() =>
                    trackForPlaylist
                      ? void handleAddTrackToPlaylist(playlist.id, trackForPlaylist.track.uri)
                      : undefined
                  }
                  variant="outline"
                >
                  <ListMusicIcon data-icon="inline-start" />
                  {playlist.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <FooterPlayer
        initialPlayback={initialPlayback}
        onDeviceChange={setBrowserDeviceId}
      />
    </>
  );
}
