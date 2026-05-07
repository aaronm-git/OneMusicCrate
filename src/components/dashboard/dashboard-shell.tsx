"use client";

import {
  CopyIcon,
  Disc3Icon,
  KeyRoundIcon,
  LibraryBigIcon,
  ListMusicIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { DuplicatesView } from "@/components/dashboard/duplicates-view";
import { FooterPlayer } from "@/components/dashboard/footer-player";
import { TrackTable, TrackTableTrackCell } from "@/components/dashboard/track-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { formatCompactNumber, formatDuration, formatRelativeDate } from "@/lib/format";
import { authClient } from "@/lib/auth-client";
import { musicKeys } from "@/lib/music-query-keys";
import { cn } from "@/lib/utils";
import type {
  AccountPayload,
  DuplicateCleanupSelection,
  MusicDashboardPayload,
  MusicPlaylistTrackView,
  MusicPlaylistView,
  MusicService,
  MusicTrackView,
  ServiceConnectionView,
  ServiceDuplicatesPayload,
  SyncHubPayload,
} from "@/lib/music-services";
import type {
  SpotifyPagedResponse,
  SpotifyPlaybackState,
} from "@/lib/spotify-types";

type DashboardView =
  | "library"
  | "playlists"
  | "duplicates"
  | "sync-hub"
  | "account";

type DashboardShellProps = {
  initialPlayback: SpotifyPlaybackState | null;
};

type PlaylistDraft = {
  description: string;
  name: string;
};

async function parseJsonResponse<T>(response: Response, fallback: string) {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(payload?.error ?? fallback);
  }

  return (await response.json()) as T;
}

async function getJson<T>(url: string, fallback = "Request failed.") {
  return parseJsonResponse<T>(await fetch(url, { cache: "no-store" }), fallback);
}

async function postJson<T>(
  url: string,
  body: Record<string, unknown> = {},
  fallback = "Request failed."
) {
  return parseJsonResponse<T>(
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    fallback
  );
}

async function deleteJson<T>(
  url: string,
  body: Record<string, unknown> = {},
  fallback = "Request failed."
) {
  return parseJsonResponse<T>(
    await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    fallback
  );
}

function summarizeDuplicateGroups(groups: ServiceDuplicatesPayload["groups"]) {
  return {
    groupCount: groups.length,
    removableTrackCount: groups.reduce(
      (total, group) => total + Math.max(0, group.duplicateCount - 1),
      0
    ),
    trackCount: groups.reduce((total, group) => total + group.duplicateCount, 0),
  };
}

function SyncBadge({ status }: { status?: string }) {
  if (status === "syncing") {
    return (
      <Badge className="rounded-full" variant="secondary">
        <Loader2Icon className="size-3 animate-spin" />
        Syncing
      </Badge>
    );
  }

  if (status === "synced" || status === "idle") {
    return (
      <Badge className="rounded-full" variant="outline">
        <ShieldCheckIcon className="size-3 text-primary" />
        Synced
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full" variant="secondary">
      Needs sync
    </Badge>
  );
}

type ServiceMarkVariant = "black" | "color" | "white";

function ServiceMark({
  className,
  service,
  variant,
}: {
  className?: string;
  service: ServiceConnectionView;
  variant?: ServiceMarkVariant;
}) {
  const resolvedVariant = variant ?? (service.theme === "tidepool" ? "white" : "color");

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-5 shrink-0 items-center justify-center",
        className
      )}
    >
      <Image
        alt=""
        className="object-contain"
        fill
        sizes="20px"
        src={`/services/${service.theme}-${resolvedVariant}.svg`}
      />
    </span>
  );
}

export function DashboardShell({ initialPlayback }: DashboardShellProps) {
  const queryClient = useQueryClient();
  const syncToastIdRef = useRef<string | number | null>(null);
  const [browserDeviceId, setBrowserDeviceId] = useState<string | null>(null);
  const [isPlayerVisible, setIsPlayerVisible] = useState(
    Boolean(initialPlayback?.item)
  );
  const [livePlayback, setLivePlayback] = useState<SpotifyPlaybackState | null>(
    initialPlayback
  );
  const [pendingTrackPlaybackUri, setPendingTrackPlaybackUri] = useState<string | null>(
    null
  );
  const [selectedService, setSelectedService] =
    useState<MusicService>("greenroom");
  const [view, setView] = useState<DashboardView>("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [trackForPlaylist, setTrackForPlaylist] =
    useState<MusicTrackView | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistDraft, setPlaylistDraft] = useState<PlaylistDraft>({
    description: "",
    name: "",
  });

  const servicesQuery = useQuery({
    queryKey: musicKeys.services(),
    queryFn: () =>
      getJson<{ services: ServiceConnectionView[] }>(
        "/api/music/services",
        "Unable to load services."
      ).then((payload) => payload.services),
  });
  const dashboardQuery = useQuery({
    queryKey: musicKeys.dashboard(selectedService),
    queryFn: () =>
      getJson<MusicDashboardPayload>(
        `/api/music/dashboard?service=${selectedService}`,
        "Unable to load service dashboard."
      ),
    refetchInterval: (query) =>
      query.state.data?.service.isSyncing ? 2_500 : false,
  });
  const syncHubQuery = useQuery({
    queryKey: musicKeys.syncHub(),
    queryFn: () =>
      getJson<SyncHubPayload>("/api/music/sync-hub", "Unable to load Sync Hub."),
    refetchInterval: (query) =>
      query.state.data?.services.some((service) => service.isSyncing)
        ? 2_500
        : false,
  });
  const duplicatesQuery = useQuery({
    queryKey: musicKeys.duplicates(selectedService),
    queryFn: () =>
      getJson<ServiceDuplicatesPayload>(
        `/api/music/services/${selectedService}/duplicates`,
        "Unable to load duplicates."
      ),
    enabled:
      view === "duplicates" &&
      (dashboardQuery.data?.service.connectionStatus ??
        servicesQuery.data?.find((service) => service.service === selectedService)
          ?.connectionStatus) === "connected",
  });
  const accountQuery = useQuery({
    queryKey: musicKeys.account(),
    queryFn: () =>
      getJson<AccountPayload>("/api/music/account", "Unable to load account."),
  });

  const services = servicesQuery.data ?? [];
  const dashboard = dashboardQuery.data;
  const selectedServiceView =
    dashboard?.service ?? services.find((service) => service.service === selectedService);
  const selectedPlaylist =
    dashboard?.playlists.find((playlist) => playlist.id === selectedPlaylistId) ??
    null;
  const duplicatesPayload: ServiceDuplicatesPayload | undefined =
    duplicatesQuery.data ??
    (selectedServiceView &&
    selectedServiceView.connectionStatus !== "connected"
      ? {
          service: selectedServiceView,
          summary: {
            groupCount: 0,
            removableTrackCount: 0,
            trackCount: 0,
          },
          groups: [],
        }
      : undefined);

  const syncMutation = useMutation({
    mutationFn: (service: MusicService) =>
      postJson<MusicDashboardPayload>(
        `/api/music/services/${service}/sync`,
        {},
        `Unable to sync ${
          services.find((item) => item.service === service)?.displayName ?? "service"
        }.`
      ),
    onMutate: (service) => {
      const serviceName =
        services.find((item) => item.service === service)?.displayName ?? "Service";
      const toastId = `music-sync-${service}`;

      syncToastIdRef.current = toastId;
      toast.loading(`${serviceName} is syncing...`, { id: toastId });
    },
    onSuccess: async (payload, service) => {
      queryClient.setQueryData(musicKeys.dashboard(service), payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: musicKeys.duplicates(service) }),
        queryClient.invalidateQueries({ queryKey: musicKeys.services() }),
        queryClient.invalidateQueries({ queryKey: musicKeys.syncHub() }),
      ]);
      toast.success(`${payload.service.displayName} sync complete.`, {
        id: syncToastIdRef.current ?? `music-sync-${service}`,
      });
      syncToastIdRef.current = null;
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to sync service.", {
        id: syncToastIdRef.current ?? "music-sync-error",
      });
      syncToastIdRef.current = null;
    },
  });

  const removeTrackMutation = useMutation({
    mutationFn: (track: MusicTrackView) =>
      postJson(`/api/music/services/${selectedService}/library`, {
        providerTrackId: track.providerTrackId,
        shouldSave: false,
      }),
    onMutate: async (track) => {
      await queryClient.cancelQueries({
        queryKey: musicKeys.dashboard(selectedService),
      });
      const previous = queryClient.getQueryData<MusicDashboardPayload>(
        musicKeys.dashboard(selectedService)
      );

      queryClient.setQueryData<MusicDashboardPayload>(
        musicKeys.dashboard(selectedService),
        (current) =>
          current
            ? {
                ...current,
                savedTracks: current.savedTracks.filter((item) => item.id !== track.id),
              }
            : current
      );

      return { previous };
    },
    onError: (error, _track, context) => {
      if (context?.previous) {
        queryClient.setQueryData(musicKeys.dashboard(selectedService), context.previous);
      }

      toast.error(error instanceof Error ? error.message : "Unable to update library.");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: musicKeys.dashboard(selectedService) }),
        queryClient.invalidateQueries({ queryKey: musicKeys.duplicates(selectedService) }),
        queryClient.invalidateQueries({ queryKey: musicKeys.syncHub() }),
      ]);
    },
  });

  const createPlaylistMutation = useMutation({
    mutationFn: (draft: PlaylistDraft) =>
      postJson<{ playlist: MusicPlaylistView }>(
        `/api/music/services/${selectedService}/playlists`,
        draft,
        "Unable to create playlist."
      ),
    onMutate: async (draft) => {
      await queryClient.cancelQueries({
        queryKey: musicKeys.dashboard(selectedService),
      });
      const previous = queryClient.getQueryData<MusicDashboardPayload>(
        musicKeys.dashboard(selectedService)
      );
      const optimistic: MusicPlaylistView = {
        id: `optimistic-${Date.now()}`,
        canonicalPlaylistId: "optimistic",
        providerPlaylistId: "optimistic",
        uri: "optimistic",
        name: draft.name,
        description: draft.description,
        images: [],
        ownerDisplayName: previous?.service.profile?.displayName ?? null,
        revision: null,
        trackTotal: 0,
        syncStatus: "syncing",
      };

      queryClient.setQueryData<MusicDashboardPayload>(
        musicKeys.dashboard(selectedService),
        (current) =>
          current
            ? {
                ...current,
                playlists: [optimistic, ...current.playlists],
              }
            : current
      );

      return { previous };
    },
    onError: (error, _draft, context) => {
      if (context?.previous) {
        queryClient.setQueryData(musicKeys.dashboard(selectedService), context.previous);
      }

      toast.error(error instanceof Error ? error.message : "Unable to create playlist.");
    },
    onSuccess: async () => {
      setPlaylistDraft({ description: "", name: "" });
      setIsCreateDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: musicKeys.dashboard(selectedService) }),
        queryClient.invalidateQueries({ queryKey: musicKeys.syncHub() }),
      ]);
      toast.success("Playlist created.");
    },
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: ({
      playlist,
      track,
    }: {
      playlist: MusicPlaylistView;
      track: MusicTrackView;
    }) =>
      postJson(`/api/music/services/${selectedService}/playlists/${playlist.providerPlaylistId}/tracks`, {
        trackUri: track.uri,
      }),
    onSuccess: async (_payload, variables) => {
      setTrackForPlaylist(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: musicKeys.dashboard(selectedService) }),
        queryClient.invalidateQueries({
          queryKey: musicKeys.playlistTracks(
            selectedService,
            variables.playlist.providerPlaylistId
          ),
        }),
        queryClient.invalidateQueries({ queryKey: musicKeys.syncHub() }),
      ]);
      toast.success("Track added to playlist.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to add track.");
    },
  });
  const cleanupDuplicatesMutation = useMutation({
    mutationFn: (groups: DuplicateCleanupSelection[]) =>
      postJson<ServiceDuplicatesPayload>(
        `/api/music/services/${selectedService}/duplicates`,
        { groups },
        "Unable to remove duplicate tracks."
      ),
    onMutate: async (groups) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: musicKeys.dashboard(selectedService),
        }),
        queryClient.cancelQueries({
          queryKey: musicKeys.duplicates(selectedService),
        }),
      ]);
      const previousDashboard = queryClient.getQueryData<MusicDashboardPayload>(
        musicKeys.dashboard(selectedService)
      );
      const previousDuplicates = queryClient.getQueryData<ServiceDuplicatesPayload>(
        musicKeys.duplicates(selectedService)
      );
      const removeTrackIds = new Set(
        groups.flatMap((group) => group.removeProviderTrackIds)
      );

      queryClient.setQueryData<MusicDashboardPayload>(
        musicKeys.dashboard(selectedService),
        (current) =>
          current
            ? {
                ...current,
                savedTracks: current.savedTracks.filter(
                  (track) => !removeTrackIds.has(track.providerTrackId)
                ),
              }
            : current
      );
      queryClient.setQueryData<ServiceDuplicatesPayload>(
        musicKeys.duplicates(selectedService),
        (current) => {
          if (!current) {
            return current;
          }

          const groups = current.groups.filter(
            (group) =>
              !group.tracks.some((track) =>
                removeTrackIds.has(track.providerTrackId)
              )
          );

          return {
            ...current,
            groups,
            summary: summarizeDuplicateGroups(groups),
          };
        }
      );

      return {
        previousDashboard,
        previousDuplicates,
      };
    },
    onError: (error, _groups, context) => {
      if (context?.previousDashboard) {
        queryClient.setQueryData(
          musicKeys.dashboard(selectedService),
          context.previousDashboard
        );
      }

      if (context?.previousDuplicates) {
        queryClient.setQueryData(
          musicKeys.duplicates(selectedService),
          context.previousDuplicates
        );
      }

      toast.error(
        error instanceof Error ? error.message : "Unable to remove duplicate tracks."
      );
    },
    onSuccess: async (payload) => {
      queryClient.setQueryData(musicKeys.duplicates(selectedService), payload);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: musicKeys.dashboard(selectedService),
        }),
        queryClient.invalidateQueries({
          queryKey: musicKeys.duplicates(selectedService),
        }),
        queryClient.invalidateQueries({ queryKey: musicKeys.services() }),
        queryClient.invalidateQueries({ queryKey: musicKeys.syncHub() }),
      ]);
      toast.success("Duplicate cleanup complete.");
    },
  });

  const shouldAutoSync = Boolean(
    dashboard &&
      dashboard.service.connectionStatus === "connected" &&
      dashboard.service.syncStatus !== "error" &&
      !dashboard.service.isSyncing &&
      (dashboard.service.isStale ||
        (!dashboard.savedTracks.length && !dashboard.playlists.length)) &&
      !syncMutation.isPending
  );

  useEffect(() => {
    if (shouldAutoSync) {
      syncMutation.mutate(selectedService);
    }
  }, [selectedService, shouldAutoSync, syncMutation]);

  const filteredTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const tracks = dashboard?.savedTracks ?? [];

    if (!query) {
      return tracks;
    }

    return tracks.filter((track) =>
      [track.title, track.album, track.artists.map((artist) => artist.name).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [dashboard?.savedTracks, searchQuery]);

  const filteredPlaylists = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const playlists = dashboard?.playlists ?? [];

    if (!query) {
      return playlists;
    }

    return playlists.filter((playlist) =>
      [playlist.name, playlist.description ?? "", playlist.ownerDisplayName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [dashboard?.playlists, searchQuery]);

  const initials = (
    selectedServiceView?.profile?.displayName ??
    selectedServiceView?.profile?.email ??
    "OM"
  )
    .slice(0, 2)
    .toUpperCase();
  const stats = [
    { label: "Saved tracks", value: dashboard?.savedTracks.length ?? 0 },
    { label: "Playlists", value: dashboard?.playlists.length ?? 0 },
    {
      label: "Followers",
      value: selectedServiceView?.profile?.followersTotal ?? 0,
    },
  ];
  const isPlaybackEnabled = Boolean(
    selectedServiceView?.capabilities.playback &&
      selectedServiceView.connectionStatus === "connected"
  );

  async function handlePlayTrack(trackUri: string) {
    if (!isPlaybackEnabled) {
      toast.error(`${selectedServiceView?.displayName ?? "This service"} playback is not available yet.`);
      return;
    }

    try {
      await postJson(`/api/music/services/${selectedService}/player`, {
        action: "play-track",
        deviceId: browserDeviceId,
        trackUri,
      });
      await queryClient.invalidateQueries({
        queryKey: musicKeys.player(selectedService),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start playback.");
    }
  }

  async function handleToggleTrackPlayback(track: MusicTrackView) {
    if (!isPlaybackEnabled) {
      toast.error(`${selectedServiceView?.displayName ?? "This service"} playback is not available yet.`);
      return;
    }

    const isCurrentTrack = livePlayback?.item?.uri === track.uri;
    const shouldPause = isCurrentTrack && livePlayback?.is_playing;

    try {
      setPendingTrackPlaybackUri(track.uri);
      await postJson(`/api/music/services/${selectedService}/player`, shouldPause
        ? {
            action: "pause",
            deviceId: browserDeviceId,
          }
        : isCurrentTrack
          ? {
              action: "resume",
              deviceId: browserDeviceId,
            }
          : {
              action: "play-track",
              deviceId: browserDeviceId,
              trackUri: track.uri,
            });
      await queryClient.invalidateQueries({
        queryKey: musicKeys.player(selectedService),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update playback.");
    } finally {
      setPendingTrackPlaybackUri(null);
    }
  }

  async function handlePlayPlaylist(contextUri: string) {
    if (!isPlaybackEnabled) {
      toast.error(`${selectedServiceView?.displayName ?? "This service"} playback is not available yet.`);
      return;
    }

    try {
      await postJson(`/api/music/services/${selectedService}/player`, {
        action: "play-context",
        contextUri,
        deviceId: browserDeviceId,
      });
      await queryClient.invalidateQueries({
        queryKey: musicKeys.player(selectedService),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start playlist.");
    }
  }

  function handleCreatePlaylist() {
    const name = playlistDraft.name.trim();

    if (!name) {
      toast.error("Give the playlist a name first.");
      return;
    }

    createPlaylistMutation.mutate({
      description: playlistDraft.description.trim(),
      name,
    });
  }

  if (dashboardQuery.isLoading || !dashboard || !selectedServiceView) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading library
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border/60">
            <div className="flex items-center gap-3 px-1 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Disc3Icon className="size-5" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-bold tracking-tight">OneMusicCrate</p>
                <p className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Multi-service library
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Service</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {services.map((service) => (
                    <SidebarMenuItem key={service.service}>
                      <SidebarMenuButton
                        isActive={selectedService === service.service}
                        onClick={() => {
                          setSelectedService(service.service);
                          setSelectedPlaylistId(null);
                        }}
                        tooltip={service.displayName}
                      >
                        <ServiceMark className="size-4" service={service} />
                        <span>{service.displayName}</span>
                        {service.comingSoon ? (
                          <Badge className="ml-auto" variant="secondary">
                            Soon
                          </Badge>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Browse</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[
                    { value: "library", label: "Library", icon: LibraryBigIcon },
                    { value: "playlists", label: "Playlists", icon: ListMusicIcon },
                    { value: "duplicates", label: "Duplicates", icon: CopyIcon },
                    { value: "sync-hub", label: "Sync Hub", icon: RefreshCcwIcon },
                    { value: "account", label: "Account", icon: KeyRoundIcon },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <SidebarMenuItem key={item.value}>
                        <SidebarMenuButton
                          isActive={view === item.value}
                          onClick={() => {
                            if (item.value === "playlists") {
                              setSelectedPlaylistId(null);
                            }

                            setView(item.value as DashboardView);
                          }}
                          tooltip={item.label}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/60">
            <div className="flex items-center gap-3 rounded-lg p-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:p-0">
              <Avatar className="size-9">
                <AvatarImage
                  alt={
                    selectedServiceView.profile?.displayName ??
                    selectedServiceView.displayName
                  }
                  src={selectedServiceView.profile?.imageUrl ?? undefined}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium">
                  {selectedServiceView.profile?.displayName ??
                    selectedServiceView.displayName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {selectedServiceView.displayName}
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset
          className="overflow-x-hidden bg-app-canvas"
          data-service-theme={selectedServiceView.theme}
        >
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/50 bg-background/70 px-4 py-3 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              <Separator className="mx-1 h-5" orientation="vertical" />
              <Badge className="rounded-full" variant="outline">
                <ServiceMark className="size-4" service={selectedServiceView} />
                {selectedServiceView.displayName}
              </Badge>
              <SyncBadge status={selectedServiceView.syncStatus} />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 w-64 rounded-full pl-9"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={`Search ${selectedServiceView.displayName}`}
                  value={searchQuery}
                />
              </div>
              <SignOutButton />
            </div>
          </header>

          <div
            className={cn(
              "flex-1",
              isPlaybackEnabled
                ? isPlayerVisible
                  ? "pb-40"
                  : "pb-20"
                : "pb-8"
            )}
          >
            <section className="bg-hero-gradient grain-overlay relative px-6 pb-10 pt-12 sm:px-10">
              <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                  <Avatar className="size-32 rounded-2xl after:border-0 sm:size-40">
                    <AvatarImage
                      alt={
                        selectedServiceView.profile?.displayName ??
                        selectedServiceView.displayName
                      }
                      className="object-cover"
                      src={selectedServiceView.profile?.imageUrl ?? undefined}
                    />
                    <AvatarFallback className="rounded-2xl text-3xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/80">
                      {selectedServiceView.displayName}
                    </span>
                    <h1 className="text-balance text-5xl font-black leading-[1] tracking-tight sm:text-6xl lg:text-7xl">
                      {selectedServiceView.profile?.displayName ??
                        selectedServiceView.displayName}
                    </h1>
                    <p className="text-sm text-foreground/85">
                      {selectedServiceView.profile?.email ??
                        `${selectedServiceView.displayName} connection`}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/85">
                      {stats.map((stat) => (
                        <span className="flex items-center gap-2" key={stat.label}>
                          <span className="font-semibold text-foreground">
                            {formatCompactNumber(stat.value)}
                          </span>
                          <span className="text-foreground/70">
                            {stat.label.toLowerCase()}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    disabled={!dashboard.savedTracks.length || !isPlaybackEnabled}
                    onClick={() => {
                      const first = dashboard.savedTracks[0];
                      if (first) void handlePlayTrack(first.uri);
                    }}
                    size="lg"
                  >
                    <PlayIcon className="fill-current" data-icon="inline-start" />
                    Play library
                  </Button>
                  <Button
                    disabled={!selectedServiceView.capabilities.playlistWrite}
                    onClick={() => setIsCreateDialogOpen(true)}
                    size="lg"
                    variant="outline"
                  >
                    <PlusIcon data-icon="inline-start" />
                    New playlist
                  </Button>
                </div>
              </div>
            </section>

            <div className="px-6 py-8 sm:px-10">
              {selectedServiceView.connectionStatus !== "connected" ? (
                <Alert className="mb-5">
                  <SparklesIcon />
                  <AlertTitle>{selectedServiceView.displayName} is not connected</AlertTitle>
                  <AlertDescription>
                    Connect this service from Account settings before syncing its library.
                  </AlertDescription>
                </Alert>
              ) : null}
              {selectedServiceView.lastError ? (
                <Alert className="mb-5">
                  <SparklesIcon />
                  <AlertTitle>Last sync failed</AlertTitle>
                  <AlertDescription>{selectedServiceView.lastError}</AlertDescription>
                </Alert>
              ) : null}

              {view === "library" ? (
                <LibraryView
                  activeTrackUri={livePlayback?.item?.uri ?? null}
                  isActiveTrackPlaying={Boolean(livePlayback?.is_playing)}
                  isPlaybackEnabled={isPlaybackEnabled}
                  onAddToPlaylist={setTrackForPlaylist}
                  onRemove={(track) => removeTrackMutation.mutate(track)}
                  onTogglePlayback={handleToggleTrackPlayback}
                  pendingPlaybackTrackUri={pendingTrackPlaybackUri}
                  pendingTrackId={removeTrackMutation.variables?.id ?? null}
                  serviceName={selectedServiceView.displayName}
                  tracks={filteredTracks}
                />
              ) : null}
              {view === "playlists" ? (
                <PlaylistsView
                  activeTrackUri={livePlayback?.item?.uri ?? null}
                  isActiveTrackPlaying={Boolean(livePlayback?.is_playing)}
                  isPlaybackEnabled={isPlaybackEnabled}
                  onCreateClick={() => setIsCreateDialogOpen(true)}
                  onOpenPlaylist={(playlist) => setSelectedPlaylistId(playlist.id)}
                  onPlayPlaylist={handlePlayPlaylist}
                  onTogglePlayback={handleToggleTrackPlayback}
                  pendingPlaybackTrackUri={pendingTrackPlaybackUri}
                  playlist={selectedPlaylist}
                  playlists={filteredPlaylists}
                  selectedService={selectedService}
                  serviceName={selectedServiceView.displayName}
                />
              ) : null}
              {view === "duplicates" ? (
                <DuplicatesView
                  cleanupPending={cleanupDuplicatesMutation.isPending}
                  isLoading={duplicatesQuery.isLoading}
                  onConfirmCleanup={(groups) =>
                    cleanupDuplicatesMutation.mutate(groups)
                  }
                  payload={duplicatesPayload}
                  serviceName={selectedServiceView.displayName}
                />
              ) : null}
              {view === "sync-hub" ? (
                <SyncHubView payload={syncHubQuery.data} />
              ) : null}
              {view === "account" ? (
                <AccountView
                  account={accountQuery.data}
                  onConnectSpotify={async () => {
                    await authClient.linkSocial({
                      callbackURL: "/dashboard",
                      provider: "spotify",
                    });
                  }}
                />
              ) : null}
            </div>
          </div>
          {isPlaybackEnabled ? (
            <FooterPlayer
              className="left-0 right-0"
              initialPlayback={initialPlayback}
              onDeviceChange={setBrowserDeviceId}
              onPlaybackChange={setLivePlayback}
              onVisibilityChange={setIsPlayerVisible}
              service={selectedService}
            />
          ) : null}
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new playlist</DialogTitle>
            <DialogDescription>
              The playlist is created in {selectedServiceView.displayName} and cached in OneMusicCrate.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="playlist-name">Name</Label>
              <Input
                id="playlist-name"
                onChange={(event) =>
                  setPlaylistDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={playlistDraft.name}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="playlist-description">Description</Label>
              <Input
                id="playlist-description"
                onChange={(event) =>
                  setPlaylistDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                value={playlistDraft.description}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={createPlaylistMutation.isPending}
              onClick={handleCreatePlaylist}
            >
              {createPlaylistMutation.isPending ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              Create playlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(trackForPlaylist)}
        onOpenChange={(open) => {
          if (!open) setTrackForPlaylist(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add track to playlist</DialogTitle>
            <DialogDescription>
              {trackForPlaylist
                ? `Choose a ${selectedServiceView.displayName} playlist for ${trackForPlaylist.title}.`
                : "Choose a playlist."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-72">
            <div className="flex flex-col gap-2 pr-2">
              {dashboard.playlists.map((playlist) => (
                <Button
                  className="justify-start"
                  disabled={addToPlaylistMutation.isPending}
                  key={playlist.id}
                  onClick={() => {
                    if (trackForPlaylist) {
                      addToPlaylistMutation.mutate({
                        playlist,
                        track: trackForPlaylist,
                      });
                    }
                  }}
                  variant="outline"
                >
                  <ListMusicIcon data-icon="inline-start" />
                  {playlist.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </>
  );
}

function PlaylistCover({ playlist, size }: { playlist: MusicPlaylistView; size: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded bg-muted"
      style={{ height: size, width: size }}
    >
      {playlist.images[0]?.url ? (
        <Image
          alt={playlist.name}
          className="object-cover"
          fill
          sizes={`${size}px`}
          src={playlist.images[0].url}
        />
      ) : (
        <ListMusicIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
      )}
    </div>
  );
}

function LibraryView({
  activeTrackUri,
  isActiveTrackPlaying,
  isPlaybackEnabled,
  onAddToPlaylist,
  onRemove,
  onTogglePlayback,
  pendingPlaybackTrackUri,
  pendingTrackId,
  serviceName,
  tracks,
}: {
  activeTrackUri: string | null;
  isActiveTrackPlaying: boolean;
  isPlaybackEnabled: boolean;
  onAddToPlaylist: (track: MusicTrackView) => void;
  onRemove: (track: MusicTrackView) => void;
  onTogglePlayback: (track: MusicTrackView) => Promise<void> | void;
  pendingPlaybackTrackUri: string | null;
  pendingTrackId: string | null;
  serviceName: string;
  tracks: MusicTrackView[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Saved library</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing only {serviceName} tracks backed up to OneMusicCrate.
          </p>
        </div>
        <Badge className="rounded-full" variant="secondary">
          {tracks.length} saved
        </Badge>
      </div>
      {tracks.length ? (
        <div className="rounded-lg border border-border/60 bg-card/40">
          <TrackTable
            actionColumnLabel="Track options"
            actionColumnWidth="4rem"
            columns={[
              {
                cellClassName: "text-muted-foreground",
                header: "#",
                headerTitle: "Index",
                id: "index",
                title: (_track, index) => String(index + 1),
                width: "4rem",
                render: (_track, index) => index + 1,
              },
              {
                header: "Track",
                headerTitle: "Track",
                id: "track",
                title: (track) => track.title,
                width: "minmax(18rem, 1.8fr)",
                render: (track) => (
                  <TrackTableTrackCell
                    playback={{
                      disabled: !isPlaybackEnabled,
                      isBusy: pendingPlaybackTrackUri === track.uri,
                      isCurrent: activeTrackUri === track.uri,
                      isPlaying: activeTrackUri === track.uri && isActiveTrackPlaying,
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
                ),
              },
              {
                cellClassName: "truncate text-sm text-muted-foreground",
                header: "Album",
                headerTitle: "Album",
                id: "album",
                title: (track) => track.album,
                width: "minmax(13rem, 1.25fr)",
                render: (track) => track.album,
              },
              {
                cellClassName: "text-sm text-muted-foreground",
                header: "Saved",
                headerTitle: "Saved",
                id: "saved",
                title: (track) => formatRelativeDate(track.savedAt),
                width: "minmax(8rem, 0.95fr)",
                render: (track) => formatRelativeDate(track.savedAt),
              },
              {
                header: "DB",
                headerTitle: "Database sync status",
                id: "db",
                title: (track) => track.syncStatus,
                width: "minmax(7rem, 0.9fr)",
                render: (track) => <SyncBadge status={track.syncStatus} />,
              },
            ]}
            getItemKey={(track) => track.id}
            isActionMenuBusy={(track) => pendingTrackId === track.id}
            items={tracks}
            menuActions={[
              {
                icon: PlusIcon,
                label: "Add to playlist",
                onSelect: (track) => onAddToPlaylist(track),
              },
              {
                disabled: (track) => pendingTrackId === track.id,
                icon: Trash2Icon,
                label: "Remove",
                onSelect: (track) => onRemove(track),
                variant: "destructive",
              },
            ]}
            stickyHeader
            virtualization={{
              bodyHeightClassName: "h-[640px]",
              overscan: 10,
              rowHeight: 64,
            }}
          />
        </div>
      ) : (
        <Empty className="rounded-lg border-border/50 bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LibraryBigIcon />
            </EmptyMedia>
            <EmptyTitle>No saved tracks cached</EmptyTitle>
            <EmptyDescription>
              {serviceName} will sync automatically after it is connected.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function PlaylistsView({
  activeTrackUri,
  isActiveTrackPlaying,
  isPlaybackEnabled,
  onCreateClick,
  onOpenPlaylist,
  onPlayPlaylist,
  onTogglePlayback,
  pendingPlaybackTrackUri,
  playlist,
  playlists,
  selectedService,
  serviceName,
}: {
  activeTrackUri: string | null;
  isActiveTrackPlaying: boolean;
  isPlaybackEnabled: boolean;
  onCreateClick: () => void;
  onOpenPlaylist: (playlist: MusicPlaylistView) => void;
  onPlayPlaylist: (uri: string) => Promise<void> | void;
  onTogglePlayback: (track: MusicTrackView) => Promise<void> | void;
  pendingPlaybackTrackUri: string | null;
  playlist: MusicPlaylistView | null;
  playlists: MusicPlaylistView[];
  selectedService: MusicService;
  serviceName: string;
}) {
  return playlist ? (
    <PlaylistDetail
      activeTrackUri={activeTrackUri}
      isActiveTrackPlaying={isActiveTrackPlaying}
      isPlaybackEnabled={isPlaybackEnabled}
      onPlayPlaylist={onPlayPlaylist}
      onTogglePlayback={onTogglePlayback}
      pendingPlaybackTrackUri={pendingPlaybackTrackUri}
      playlist={playlist}
      selectedService={selectedService}
      serviceName={serviceName}
    />
  ) : (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Playlists</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing only {serviceName} playlists.
          </p>
        </div>
        <Button onClick={onCreateClick}>
          <PlusIcon data-icon="inline-start" />
          New playlist
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {playlists.map((item) => (
          <button
            className="flex min-w-0 items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 text-left transition-colors hover:bg-card"
            key={item.id}
            onClick={() => onOpenPlaylist(item)}
            type="button"
          >
            <PlaylistCover playlist={item} size={56} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {item.trackTotal} tracks
              </p>
            </div>
            <SyncBadge status={item.syncStatus} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PlaylistDetail({
  activeTrackUri,
  isActiveTrackPlaying,
  isPlaybackEnabled,
  onPlayPlaylist,
  onTogglePlayback,
  pendingPlaybackTrackUri,
  playlist,
  selectedService,
  serviceName,
}: {
  activeTrackUri: string | null;
  isActiveTrackPlaying: boolean;
  isPlaybackEnabled: boolean;
  onPlayPlaylist: (uri: string) => Promise<void> | void;
  onTogglePlayback: (track: MusicTrackView) => Promise<void> | void;
  pendingPlaybackTrackUri: string | null;
  playlist: MusicPlaylistView;
  selectedService: MusicService;
  serviceName: string;
}) {
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({
    queryKey: musicKeys.playlistTracks(selectedService, playlist.providerPlaylistId),
    queryFn: () =>
      getJson<SpotifyPagedResponse<MusicPlaylistTrackView>>(
        `/api/music/services/${selectedService}/playlists/${playlist.providerPlaylistId}/tracks`,
        "Unable to load playlist tracks."
      ),
  });
  const removeMutation = useMutation({
    mutationFn: (trackUri: string) =>
      deleteJson(`/api/music/services/${selectedService}/playlists/${playlist.providerPlaylistId}/tracks`, {
        snapshotId: playlist.revision,
        trackUri,
      }),
    onMutate: async (trackUri) => {
      await queryClient.cancelQueries({
        queryKey: musicKeys.playlistTracks(selectedService, playlist.providerPlaylistId),
      });
      const previous = queryClient.getQueryData<
        SpotifyPagedResponse<MusicPlaylistTrackView>
      >(musicKeys.playlistTracks(selectedService, playlist.providerPlaylistId));

      queryClient.setQueryData<SpotifyPagedResponse<MusicPlaylistTrackView>>(
        musicKeys.playlistTracks(selectedService, playlist.providerPlaylistId),
        (current) =>
          current
            ? {
                ...current,
                items: current.items.filter((item) => item.providerTrackUri !== trackUri),
                total: Math.max(0, current.total - 1),
              }
            : current
      );

      return { previous };
    },
    onError: (error, _trackUri, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          musicKeys.playlistTracks(selectedService, playlist.providerPlaylistId),
          context.previous
        );
      }

      toast.error(error instanceof Error ? error.message : "Unable to remove track.");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: musicKeys.playlistTracks(selectedService, playlist.providerPlaylistId),
        }),
        queryClient.invalidateQueries({ queryKey: musicKeys.dashboard(selectedService) }),
        queryClient.invalidateQueries({ queryKey: musicKeys.syncHub() }),
      ]);
    },
  });
  const playlistItems = (itemsQuery.data?.items ?? []).filter(
    (item): item is MusicPlaylistTrackView & { track: MusicTrackView } => Boolean(item.track)
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-end gap-4">
          <PlaylistCover playlist={playlist} size={96} />
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold tracking-tight">
              {playlist.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {serviceName} · {playlist.trackTotal} tracks ·{" "}
              {playlist.description || "No description"}
            </p>
            <div className="mt-2">
              <SyncBadge status={playlist.syncStatus} />
            </div>
          </div>
        </div>
        <Button
          disabled={!isPlaybackEnabled}
          onClick={() => void onPlayPlaylist(playlist.uri)}
        >
          <PlayIcon className="fill-current" data-icon="inline-start" />
          Play playlist
        </Button>
      </div>
      <div className="rounded-lg border border-border/60 bg-card/40">
        {itemsQuery.isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading playlist
          </div>
        ) : (
          <TrackTable
            actionColumnLabel="Playlist track options"
            actionColumnWidth="4rem"
            columns={[
              {
                header: "Track",
                headerTitle: "Track",
                id: "track",
                title: (item) => item.track.title,
                width: "18rem",
                render: (item) => (
                  <TrackTableTrackCell
                    coverSize={40}
                    playback={{
                      disabled: !isPlaybackEnabled,
                      isBusy: pendingPlaybackTrackUri === item.track.uri,
                      isCurrent: activeTrackUri === item.track.uri,
                      isPlaying: activeTrackUri === item.track.uri && isActiveTrackPlaying,
                      onToggle: () => void onTogglePlayback(item.track),
                    }}
                    subtitle={item.track.artists.map((artist) => artist.name).join(", ")}
                    track={item.track}
                  />
                ),
              },
              {
                cellClassName: "text-sm text-muted-foreground",
                header: "Added",
                headerTitle: "Added",
                id: "added",
                title: (item) =>
                  item.addedAt ? formatRelativeDate(item.addedAt) : "Unknown",
                width: "9rem",
                render: (item) => (item.addedAt ? formatRelativeDate(item.addedAt) : "Unknown"),
              },
            ]}
            getItemKey={(item) => item.id}
            isActionMenuBusy={() => removeMutation.isPending}
            isActionMenuDisabled={() => removeMutation.isPending}
            items={playlistItems}
            menuActions={[
              {
                disabled: () => removeMutation.isPending,
                icon: Trash2Icon,
                label: "Remove from playlist",
                onSelect: (item) => removeMutation.mutate(item.providerTrackUri),
                variant: "destructive",
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}

function SyncHubView({
  payload,
}: {
  payload: SyncHubPayload | undefined;
}) {
  const services = payload?.services ?? [];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sync Hub</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage connected services, sync health, and future merge workflows.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.service}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <ServiceMark service={service} />
                    {service.displayName}
                  </span>
                  <SyncBadge status={service.syncStatus} />
                </CardTitle>
                <CardDescription>
                  {service.connectionStatus === "connected"
                    ? "Connected"
                    : service.comingSoon
                      ? "Coming soon"
                      : "Not connected"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Tracks</span>
                  <span className="text-right font-medium">
                    {service.counts.savedTracks}
                  </span>
                  <span className="text-muted-foreground">Playlists</span>
                  <span className="text-right font-medium">
                    {service.counts.playlists}
                  </span>
                  <span className="text-muted-foreground">Last sync</span>
                  <span className="text-right font-medium">
                    {service.lastSuccessfulSyncAt
                      ? formatRelativeDate(service.lastSuccessfulSyncAt)
                      : "Never"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {service.connectionStatus === "connected"
                    ? service.isSyncing
                      ? `${service.displayName} is syncing automatically.`
                      : `${service.displayName} syncs automatically when updates are needed.`
                    : `${service.displayName} will not sync until it is connected.`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Merge controls</CardTitle>
          <CardDescription>
            Future workflows for library matching, overrides, and unavailable tracks.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button disabled variant="outline">
            <Settings2Icon data-icon="inline-start" />
            Resolve conflicts
          </Button>
          <Button disabled variant="outline">
            <ShieldCheckIcon data-icon="inline-start" />
            Apply overrides
          </Button>
          <Button disabled variant="outline">
            <SparklesIcon data-icon="inline-start" />
            Merge libraries
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountView({
  account,
  onConnectSpotify,
}: {
  account: AccountPayload | undefined;
  onConnectSpotify: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const queryClient = useQueryClient();
  const passwordMutation = useMutation({
    mutationFn: () =>
      postJson("/api/account/password", {
        confirmPassword,
        currentPassword,
        newPassword,
      }),
    onSuccess: async () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await queryClient.invalidateQueries({ queryKey: musicKeys.account() });
      toast.success("Password updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update password.");
    },
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Account settings</CardTitle>
          <CardDescription>
            Manage email sign-in and connected streaming services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              passwordMutation.mutate();
            }}
          >
            {account?.hasPassword ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  type="password"
                  value={currentPassword}
                />
              </div>
            ) : (
              <Alert>
                <KeyRoundIcon />
                <AlertTitle>No password set</AlertTitle>
                <AlertDescription>
                  Add a password to sign in with email and password.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  value={newPassword}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  value={confirmPassword}
                />
              </div>
            </div>
            <Button className="self-start" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <ShieldCheckIcon data-icon="inline-start" />
              )}
              {account?.hasPassword ? "Change password" : "Set password"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Connect services</CardTitle>
          <CardDescription>
            Add streaming services for future library merge and sync workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(account?.services ?? []).map((service) => (
            <Button
              className="justify-center"
              disabled={service.comingSoon || service.connectionStatus === "connected"}
              key={service.service}
              onClick={service.displayName === "Spotify" ? onConnectSpotify : undefined}
              variant="outline"
            >
              <span className="flex w-56 items-center justify-start gap-2 text-left">
                <ServiceMark service={service} />
                <span className="flex items-center gap-2">
                  <span>
                    {service.connectionStatus === "connected"
                      ? `${service.displayName} connected`
                      : `Connect ${service.displayName}`}
                  </span>
                  {service.comingSoon ? (
                    <Badge className="rounded-full" variant="secondary">
                      Coming soon
                    </Badge>
                  ) : null}
                </span>
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
