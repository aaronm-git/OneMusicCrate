"use client";

import {
  AlbumIcon,
  ArrowLeftIcon,
  AudioLinesIcon,
  CopyIcon,
  Disc3Icon,
  ExternalLinkIcon,
  HeartIcon,
  LibraryBigIcon,
  ListMusicIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { FooterPlayer } from "@/components/dashboard/footer-player";
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
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompactNumber, formatDuration, formatRelativeDate } from "@/lib/format";
import type {
  SpotifyPagedResponse,
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifyPlaylistItem,
  SpotifyProfile,
  SpotifySavedTrack,
} from "@/lib/spotify-types";

type DashboardView = "library" | "dups" | "playlists" | "sync";

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

type SmartSearchToken = {
  label: string;
  value: string;
  hint: string;
};

type ParsedSmartSearch = {
  album: string;
  artist: string;
  explicit: boolean;
  long: boolean;
  playlist: string;
  recent: boolean;
  short: boolean;
  text: string;
};

type SearchResult<T> = {
  item: T;
  score: number;
};

type DuplicateTrackGroup = {
  key: string;
  primaryArtist: string;
  title: string;
  tracks: SpotifySavedTrack[];
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

async function getJson<T>(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(payload?.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}

async function deleteJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "DELETE",
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

const NAV_ITEMS: { value: DashboardView; label: string; icon: typeof LibraryBigIcon }[] = [
  { value: "library", label: "Library", icon: LibraryBigIcon },
  { value: "dups", label: "Dups", icon: CopyIcon },
  { value: "playlists", label: "Playlists", icon: ListMusicIcon },
  { value: "sync", label: "Sync", icon: RefreshCcwIcon },
];

const SMART_SEARCH_TOKENS: SmartSearchToken[] = [
  { label: "artist:", value: "artist:", hint: "Match a specific artist" },
  { label: "album:", value: "album:", hint: "Match an album title" },
  { label: "playlist:", value: "playlist:", hint: "Find crate playlists" },
  { label: "recent", value: "recent", hint: "Saved in the last 30 days" },
  { label: "explicit", value: "explicit", hint: "Explicit tracks only" },
  { label: "long", value: "long", hint: "Tracks over 5 minutes" },
  { label: "short", value: "short", hint: "Tracks under 2:30" },
];

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeDuplicateText(value: string | null | undefined) {
  return normalizeSearchText(value).replace(/\s+/g, " ");
}

function getDuplicateTrackGroups(savedTracks: SpotifySavedTrack[]) {
  const groups = new Map<string, DuplicateTrackGroup>();

  for (const item of savedTracks) {
    const title = normalizeDuplicateText(item.track.name);
    const primaryArtist = normalizeDuplicateText(item.track.artists[0]?.name);

    if (!title || !primaryArtist) {
      continue;
    }

    const key = `${title}::${primaryArtist}`;
    const existing = groups.get(key);

    if (existing) {
      existing.tracks.push(item);
      continue;
    }

    groups.set(key, {
      key,
      primaryArtist: item.track.artists[0]?.name ?? "Unknown artist",
      title: item.track.name,
      tracks: [item],
    });
  }

  return Array.from(groups.values())
    .filter((group) => group.tracks.length > 1)
    .sort(
      (first, second) =>
        second.tracks.length - first.tracks.length ||
        first.title.localeCompare(second.title)
    );
}

function parseSmartSearch(query: string): ParsedSmartSearch {
  let text = query.trim();

  function pullDirective(key: "album" | "artist" | "playlist") {
    const expression = new RegExp(`(?:^|\\s)${key}:("[^"]+"|\\S+)`, "i");
    const match = text.match(expression);

    if (!match?.[1]) {
      return "";
    }

    text = text.replace(match[0], " ");
    return normalizeSearchText(match[1].replace(/^"|"$/g, ""));
  }

  function pullFlag(flag: "explicit" | "long" | "recent" | "short") {
    const expression = new RegExp(`(?:^|\\s)${flag}(?=\\s|$)`, "i");
    const hasFlag = expression.test(text);
    text = text.replace(expression, " ");
    return hasFlag;
  }

  return {
    album: pullDirective("album"),
    artist: pullDirective("artist"),
    explicit: pullFlag("explicit"),
    long: pullFlag("long"),
    playlist: pullDirective("playlist"),
    recent: pullFlag("recent"),
    short: pullFlag("short"),
    text: normalizeSearchText(text.replace(/\s+/g, " ")),
  };
}

function isRecentlySaved(isoDate: string) {
  const savedAt = new Date(isoDate).getTime();

  if (Number.isNaN(savedAt)) {
    return false;
  }

  return Date.now() - savedAt <= 30 * 24 * 60 * 60 * 1000;
}

function scoreTextMatch(query: string, value: string, exactScore: number) {
  if (!query) {
    return 0;
  }

  if (value === query) {
    return exactScore;
  }

  if (value.startsWith(query)) {
    return exactScore - 20;
  }

  if (value.includes(query)) {
    return exactScore - 40;
  }

  return 0;
}

function scoreTrackSearch(item: SpotifySavedTrack, parsed: ParsedSmartSearch) {
  const title = normalizeSearchText(item.track.name);
  const artists = normalizeSearchText(
    item.track.artists.map((artist) => artist.name).join(" ")
  );
  const album = normalizeSearchText(item.track.album.name);
  const savedDate = normalizeSearchText(
    `${item.added_at.split("T")[0]} ${new Date(item.added_at).toLocaleDateString(
      "en-US",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    )}`
  );
  const searchable = [title, artists, album, savedDate].join(" ");

  if (parsed.artist && !artists.includes(parsed.artist)) {
    return -1;
  }

  if (parsed.album && !album.includes(parsed.album)) {
    return -1;
  }

  if (parsed.playlist) {
    return -1;
  }

  if (parsed.explicit && !item.track.explicit) {
    return -1;
  }

  if (parsed.recent && !isRecentlySaved(item.added_at)) {
    return -1;
  }

  if (parsed.long && item.track.duration_ms <= 5 * 60 * 1000) {
    return -1;
  }

  if (parsed.short && item.track.duration_ms >= 2.5 * 60 * 1000) {
    return -1;
  }

  let score = 0;

  if (parsed.text) {
    score += scoreTextMatch(parsed.text, title, 140);
    score += scoreTextMatch(parsed.text, artists, 110);
    score += scoreTextMatch(parsed.text, album, 90);

    if (!score && !searchable.includes(parsed.text)) {
      return -1;
    }

    score += searchable.includes(parsed.text) ? 20 : 0;
  }

  if (parsed.artist) score += 35;
  if (parsed.album) score += 30;
  if (parsed.explicit) score += 12;
  if (parsed.recent) score += 20;
  if (parsed.long || parsed.short) score += 10;

  return score || 8;
}

function scorePlaylistSearch(playlist: SpotifyPlaylist, parsed: ParsedSmartSearch) {
  const name = normalizeSearchText(playlist.name);
  const description = normalizeSearchText(playlist.description);
  const owner = normalizeSearchText(playlist.owner.display_name);
  const searchable = [
    name,
    description,
    owner,
    playlist.public ? "public" : "private",
    playlist.collaborative ? "collaborative" : "",
    `${playlist.tracks.total} tracks`,
  ].join(" ");

  if (
    parsed.artist ||
    parsed.album ||
    parsed.explicit ||
    parsed.recent ||
    parsed.long ||
    parsed.short
  ) {
    return -1;
  }

  if (parsed.playlist && !searchable.includes(parsed.playlist)) {
    return -1;
  }

  let score = parsed.playlist ? 55 : 0;

  if (parsed.text) {
    score += scoreTextMatch(parsed.text, name, 130);
    score += scoreTextMatch(parsed.text, description, 75);
    score += scoreTextMatch(parsed.text, owner, 60);

    if (!score && !searchable.includes(parsed.text)) {
      return -1;
    }
  }

  return score || 6;
}

export function DashboardShell({
  initialPlayback,
  notices,
  playlists: initialPlaylists,
  profile,
  savedTracks,
}: DashboardShellProps) {
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
  const [pendingPlaylistTrackUri, setPendingPlaylistTrackUri] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<SpotifyPlaylistItem[]>([]);
  const [playlistItemsPage, setPlaylistItemsPage] =
    useState<SpotifyPagedResponse<SpotifyPlaylistItem> | null>(null);
  const [activeTrackUri, setActiveTrackUri] = useState(
    initialPlayback?.is_playing ? initialPlayback.item?.uri ?? null : null
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [spotlightPlaylistId, setSpotlightPlaylistId] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>("library");
  const [isPlaylistDetailLoading, setIsPlaylistDetailLoading] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const parsedSearch = useMemo(
    () => parseSmartSearch(deferredSearchQuery),
    [deferredSearchQuery]
  );

  const activePlan = profile.product ? profile.product.toUpperCase() : "FREE";

  const stats = useMemo(
    () => [
      { label: "Saved tracks", value: savedTracks.length },
      { label: "Playlists", value: playlists.length },
      { label: "Followers", value: profile.followers.total },
    ],
    [playlists.length, profile.followers.total, savedTracks.length]
  );

  const trackSearchResults = useMemo(
    () =>
      savedTracks
        .map((item): SearchResult<SpotifySavedTrack> => ({
          item,
          score: scoreTrackSearch(item, parsedSearch),
        }))
        .filter((result) => result.score >= 0)
        .sort((first, second) => second.score - first.score)
        .slice(0, 8),
    [parsedSearch, savedTracks]
  );

  const duplicateTrackGroups = useMemo(
    () => getDuplicateTrackGroups(savedTracks),
    [savedTracks]
  );

  const playlistSearchResults = useMemo(
    () =>
      playlists
        .map((item): SearchResult<SpotifyPlaylist> => ({
          item,
          score: scorePlaylistSearch(item, parsedSearch),
        }))
        .filter((result) => result.score >= 0)
        .sort((first, second) => second.score - first.score)
        .slice(0, 6),
    [parsedSearch, playlists]
  );

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId]
  );

  const hasSearchIntent = Boolean(
    parsedSearch.text ||
      parsedSearch.album ||
      parsedSearch.artist ||
      parsedSearch.explicit ||
      parsedSearch.long ||
      parsedSearch.playlist ||
      parsedSearch.recent ||
      parsedSearch.short
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
    }

    document.addEventListener("keydown", handleShortcut);

    return () => {
      document.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  async function handleRemoveTrack(trackId: string) {
    try {
      setPendingTrackId(trackId);
      await postJson("/api/spotify/library", {
        trackId,
        shouldSave: false,
      });
      toast.success("Removed from your library.");
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
      toast.success("Playlist created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the playlist.");
    } finally {
      setPendingPlaylistAction(null);
    }
  }

  async function handleAddTrackToPlaylist(playlistId: string, trackUri: string) {
    try {
      setPendingPlaylistAction(playlistId);
      const payload = await postJson<{ snapshotId?: string }>(
        `/api/spotify/playlists/${playlistId}/tracks`,
        {
          trackUri,
        }
      );
      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                snapshot_id: payload?.snapshotId ?? playlist.snapshot_id,
                tracks: {
                  total: playlist.tracks.total + 1,
                },
              }
            : playlist
        )
      );
      if (selectedPlaylistId === playlistId) {
        void loadPlaylistItems(playlistId);
      }
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
      setActiveTrackUri(trackUri);
      toast.success(
        browserDeviceId
          ? "Playing through the OneMusicCrate browser player."
          : "Sent to your active streaming device."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start playback.");
    }
  }

  async function handlePlayPlaylist(contextUri: string) {
    try {
      await postJson("/api/spotify/player", {
        action: "play-context",
        contextUri,
        deviceId: browserDeviceId,
      });
      setActiveTrackUri(null);
      toast.success(
        browserDeviceId
          ? "Playing playlist through the OneMusicCrate browser player."
          : "Sent playlist to your active streaming device."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start playlist.");
    }
  }

  async function handlePausePlayback() {
    try {
      await postJson("/api/spotify/player", {
        action: "pause",
        deviceId: browserDeviceId,
      });
      setActiveTrackUri(null);
      toast.success("Playback paused.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to pause playback.");
    }
  }

  async function loadPlaylistItems(
    playlistId: string,
    offset = 0,
    append = false
  ) {
    try {
      setIsPlaylistDetailLoading(true);
      const page = await getJson<SpotifyPagedResponse<SpotifyPlaylistItem>>(
        `/api/spotify/playlists/${playlistId}/tracks?offset=${offset}&limit=50`
      );

      setPlaylistItems((current) => (append ? [...current, ...page.items] : page.items));
      setPlaylistItemsPage(page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load playlist tracks.");
    } finally {
      setIsPlaylistDetailLoading(false);
    }
  }

  function openPlaylistDetail(playlistId: string) {
    setView("playlists");
    setSelectedPlaylistId(playlistId);
    setSpotlightPlaylistId(playlistId);
    setPlaylistItems([]);
    setPlaylistItemsPage(null);
    void loadPlaylistItems(playlistId);
  }

  async function handleRemovePlaylistTrack(playlistId: string, trackUri: string) {
    try {
      setPendingPlaylistTrackUri(trackUri);
      const payload = await deleteJson<{ snapshotId?: string }>(
        `/api/spotify/playlists/${playlistId}/tracks`,
        {
          snapshotId: selectedPlaylist?.snapshot_id,
          trackUri,
        }
      );
      const removedCount = playlistItems.filter((item) => item.track?.uri === trackUri).length || 1;

      setPlaylistItems((current) =>
        current.filter((item) => item.track?.uri !== trackUri)
      );
      setPlaylistItemsPage((current) =>
        current
          ? {
              ...current,
              total: Math.max(0, current.total - removedCount),
            }
          : current
      );
      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                snapshot_id: payload?.snapshotId ?? playlist.snapshot_id,
                tracks: {
                  total: Math.max(0, playlist.tracks.total - removedCount),
                },
              }
            : playlist
        )
      );
      toast.success("Removed from playlist.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove the track.");
    } finally {
      setPendingPlaylistTrackUri(null);
    }
  }

  function handleShufflePlay() {
    const first = savedTracks[0];
    if (!first) {
      toast.error("Nothing in your library yet.");
      return;
    }
    void handlePlayTrack(first.track.uri);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  function applySmartToken(token: SmartSearchToken) {
    setSearchQuery((current) => {
      const next = current.trim();

      if (!next) {
        return token.value;
      }

      if (next.includes(token.value)) {
        return next;
      }

      return `${next} ${token.value}`;
    });
  }

  function handleSearchAction(action: "create-playlist" | "play-library" | "sync") {
    closeSearch();

    if (action === "create-playlist") {
      setIsCreateDialogOpen(true);
      return;
    }

    if (action === "play-library") {
      handleShufflePlay();
      return;
    }

    setView("sync");
  }

  function handleSelectTrack(track: SpotifySavedTrack) {
    closeSearch();
    setView("library");
    void handlePlayTrack(track.track.uri);
  }

  function handleSelectPlaylist(playlistId: string) {
    closeSearch();
    openPlaylistDetail(playlistId);
  }

  const initials = (profile.display_name ?? profile.email).slice(0, 2).toUpperCase();
  const heroSubtitle =
    activePlan === "PREMIUM" ? "Premium · Browser playback unlocked" : "Free account · Library control ready";

  return (
    <>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border/60">
            <div className="flex items-center gap-3 px-1 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_24px_color-mix(in_oklch,var(--color-brand-green)_45%,transparent)]">
                <Disc3Icon className="size-5" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-bold tracking-tight">OneMusicCrate</p>
                <p className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Global library control
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Browse</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = view === item.value;
                    return (
                      <SidebarMenuItem key={item.value}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setView(item.value)}
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

            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <div className="flex items-center justify-between pr-1">
                <SidebarGroupLabel>Your playlists</SidebarGroupLabel>
                <Button
                  className="size-6 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => setIsCreateDialogOpen(true)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
              <SidebarGroupContent>
                <ScrollArea className="h-[calc(100svh-22rem)] min-h-[180px] pr-2">
                  <SidebarMenu>
                    {playlists.length ? (
                      playlists.map((playlist) => (
                        <SidebarMenuItem key={playlist.id}>
                          <SidebarMenuButton
                            className="h-12 gap-3"
                            onClick={() => openPlaylistDetail(playlist.id)}
                            tooltip={playlist.name}
                          >
                            <div className="relative size-8 shrink-0 overflow-hidden rounded bg-muted">
                              {playlist.images?.[0]?.url ? (
                                <Image
                                  alt={playlist.name}
                                  className="object-cover"
                                  fill
                                  sizes="32px"
                                  src={playlist.images[0].url}
                                />
                              ) : (
                                <ListMusicIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-medium">
                                {playlist.name}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {playlist.tracks.total} tracks
                              </span>
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))
                    ) : (
                      <p className="px-2 py-4 text-xs text-muted-foreground">
                        No playlists yet — create your first crate.
                      </p>
                    )}
                  </SidebarMenu>
                </ScrollArea>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/60">
            <div className="flex items-center gap-3 rounded-lg p-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:p-0">
              <Avatar className="size-9">
                <AvatarImage
                  alt={profile.display_name ?? profile.email}
                  src={profile.images[0]?.url}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium">
                  {profile.display_name ?? "Music listener"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {activePlan} · {profile.country}
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="overflow-x-hidden bg-app-canvas">
          {/* Sticky top toolbar */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/50 bg-background/70 px-4 py-3 backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator className="mx-1 h-5" orientation="vertical" />
              <Badge className="rounded-full" variant="secondary">
                <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-primary" />
                Library connected
              </Badge>
              <Badge className="rounded-full" variant="outline">
                {browserDeviceId ? "Browser device ready" : "Connect browser to play here"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Open smart search"
                className="rounded-full sm:hidden"
                onClick={() => setSearchOpen(true)}
                size="icon-sm"
                variant="outline"
              >
                <SearchIcon className="size-4" />
              </Button>
              <Button
                className="hidden rounded-full border-border/70 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground sm:inline-flex"
                onClick={() => setSearchOpen(true)}
                size="sm"
                variant="outline"
              >
                <SearchIcon data-icon="inline-start" />
                Search
                <kbd className="ml-2 rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Cmd K
                </kbd>
              </Button>
              <SignOutButton />
            </div>
          </header>

          {/* Main scrollable region — bottom-padded so the sticky footer player never covers content */}
          <div className="flex-1 pb-40">
            {/* Hero band */}
            <section className="bg-hero-gradient grain-overlay relative px-6 pb-10 pt-12 sm:px-10">
              <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                  <div className="relative">
                    <Avatar className="size-32 rounded-2xl after:border-0 sm:size-40">
                      <AvatarImage
                        alt={profile.display_name ?? profile.email}
                        className="object-cover"
                        src={profile.images[0]?.url}
                      />
                      <AvatarFallback className="rounded-2xl text-3xl font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/80">
                      Profile
                    </span>
                    <h1 className="text-balance text-5xl font-black leading-[1] tracking-tight sm:text-6xl lg:text-7xl">
                      {profile.display_name ?? "Music listener"}
                    </h1>
                    <p className="text-sm text-foreground/85">
                      {heroSubtitle} · {profile.email}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/85">
                      {stats.map((stat, index) => (
                        <span className="flex items-center gap-2" key={stat.label}>
                          {index > 0 ? (
                            <span aria-hidden className="size-1 rounded-full bg-foreground/40" />
                          ) : null}
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
                  <button
                    className="btn-pill-primary"
                    disabled={!savedTracks.length}
                    onClick={handleShufflePlay}
                    type="button"
                  >
                    <PlayIcon className="size-5 fill-current" />
                    Play library
                  </button>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger
                      render={
                        <Button
                          className="rounded-full border-foreground/20 bg-transparent text-foreground hover:border-foreground/50 hover:bg-foreground/10"
                          variant="outline"
                        />
                      }
                    >
                      <PlusIcon data-icon="inline-start" />
                      New playlist
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create a new crate playlist</DialogTitle>
                        <DialogDescription>
                          A private playlist that lives in your global library, available immediately as a crate target.
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
                          className="rounded-full"
                          disabled={pendingPlaylistAction === "create"}
                          onClick={() => void handleCreatePlaylist()}
                        >
                          <PlusIcon data-icon="inline-start" />
                          Create playlist
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </section>

            <div className="px-6 sm:px-10">
              {notices.length ? (
                <div className="-mt-2 flex flex-col gap-3 pb-2">
                  {notices.map((notice) => (
                    <Alert key={notice}>
                      <SparklesIcon />
                      <AlertTitle>Library data loaded with a partial fallback</AlertTitle>
                      <AlertDescription>{notice}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : null}

              <div className="py-8">
                {view === "library" ? (
                  <LibraryView
                    onAddToPlaylist={setTrackForPlaylist}
                    onPlay={handlePlayTrack}
                    onRemove={handleRemoveTrack}
                    pendingTrackId={pendingTrackId}
                    savedTracks={savedTracks}
                  />
                ) : null}
                {view === "dups" ? (
                  <DupsView
                    duplicateGroups={duplicateTrackGroups}
                    onAddToPlaylist={setTrackForPlaylist}
                    onPlay={handlePlayTrack}
                    onRemove={handleRemoveTrack}
                    pendingTrackId={pendingTrackId}
                  />
                ) : null}
                {view === "playlists" ? (
                  <PlaylistsView
                    activeTrackUri={activeTrackUri}
                    isDetailLoading={isPlaylistDetailLoading}
                    onBack={() => setSelectedPlaylistId(null)}
                    onCreateClick={() => setIsCreateDialogOpen(true)}
                    onLoadMore={() => {
                      if (selectedPlaylistId && playlistItemsPage?.next) {
                        void loadPlaylistItems(
                          selectedPlaylistId,
                          playlistItemsPage.offset + playlistItemsPage.limit,
                          true
                        );
                      }
                    }}
                    onOpenPlaylist={openPlaylistDetail}
                    onPlayPlaylist={handlePlayPlaylist}
                    onPausePlayback={handlePausePlayback}
                    onPlayTrack={handlePlayTrack}
                    onRemoveTrack={handleRemovePlaylistTrack}
                    pendingTrackUri={pendingPlaylistTrackUri}
                    playlistItems={playlistItems}
                    playlistItemsPage={playlistItemsPage}
                    playlists={playlists}
                    selectedPlaylist={selectedPlaylist}
                    spotlightPlaylistId={spotlightPlaylistId}
                  />
                ) : null}
                {view === "sync" ? (
                  <SyncView browserDeviceId={browserDeviceId} />
                ) : null}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <CommandDialog
        className="max-w-2xl border-border/70 bg-popover/95 shadow-2xl backdrop-blur-xl"
        description="Search tracks, playlists, and OneMusicCrate actions."
        onOpenChange={(open) => {
          setSearchOpen(open);

          if (!open) {
            setSearchQuery("");
          }
        }}
        open={searchOpen}
        title="Smart search"
      >
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={setSearchQuery}
            placeholder='Search tracks, artists, albums, playlists, or try "artist:"'
            value={searchQuery}
          />
          <div className="flex flex-wrap gap-2 px-2 py-2">
            {SMART_SEARCH_TOKENS.map((token) => (
              <button
                className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-foreground"
                key={token.value}
                onClick={() => applySmartToken(token)}
                title={token.hint}
                type="button"
              >
                {token.label}
              </button>
            ))}
          </div>
          <CommandList className="max-h-[520px]">
            {hasSearchIntent &&
            !trackSearchResults.length &&
            !playlistSearchResults.length ? (
              <CommandEmpty>
                No tracks or playlists match this search. Try a different title,
                artist, album, or smart chip.
              </CommandEmpty>
            ) : null}

            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => handleSearchAction("play-library")}
                value="action play library shuffle saved tracks"
              >
                <PlayIcon className="size-4 fill-current text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">Play library</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Start playback from your saved tracks.
                  </p>
                </div>
                <CommandShortcut>{savedTracks.length} saved</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSearchAction("create-playlist")}
                value="action create new playlist crate"
              >
                <PlusIcon className="size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">Create playlist</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Open the private crate playlist dialog.
                  </p>
                </div>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSearchAction("sync")}
                value="action go to sync provider status"
              >
                <SparklesIcon className="size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">Go to Sync</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Review connected-provider state.
                  </p>
                </div>
              </CommandItem>
            </CommandGroup>

            {trackSearchResults.length ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Tracks">
                  {trackSearchResults.map(({ item }) => (
                    <CommandItem
                      className="items-center py-2"
                      key={item.track.id}
                      onSelect={() => handleSelectTrack(item)}
                      value={`track ${item.track.name} ${item.track.album.name} ${item.track.artists
                        .map((artist) => artist.name)
                        .join(" ")}`}
                    >
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.track.album.images[0]?.url ? (
                          <Image
                            alt={item.track.album.name}
                            className="object-cover"
                            fill
                            sizes="40px"
                            src={item.track.album.images[0].url}
                          />
                        ) : (
                          <AlbumIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.track.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.track.artists.map((artist) => artist.name).join(", ")}
                          <span className="mx-1.5">·</span>
                          {item.track.album.name}
                        </p>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        {item.track.explicit ? (
                          <Badge className="rounded-full" variant="outline">
                            Explicit
                          </Badge>
                        ) : null}
                        <Button
                          className="h-7 rounded-full px-2 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            setTrackForPlaylist(item);
                            setSearchOpen(false);
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          size="sm"
                          variant="secondary"
                        >
                          <PlusIcon className="size-3.5" />
                          Add
                        </Button>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {playlistSearchResults.length ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Playlists">
                  {playlistSearchResults.map(({ item }) => (
                    <CommandItem
                      className="items-center py-2"
                      key={item.id}
                      onSelect={() => handleSelectPlaylist(item.id)}
                      value={`playlist ${item.name} ${item.description ?? ""} ${
                        item.owner.display_name ?? ""
                      } ${item.tracks.total} tracks`}
                    >
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.images?.[0]?.url ? (
                          <Image
                            alt={item.name}
                            className="object-cover"
                            fill
                            sizes="40px"
                            src={item.images[0].url}
                          />
                        ) : (
                          <ListMusicIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.description || "Private crate playlist"}
                        </p>
                      </div>
                      <CommandShortcut>{item.tracks.total} tracks</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {!hasSearchIntent ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Search tips">
                  <CommandItem disabled value="tip artist album playlist filters">
                    <SearchIcon className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Try artist:phoebe, album:&quot;night drive&quot;, playlist:crate,
                      recent, explicit, long, or short.
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>

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
            <div className="flex flex-col gap-2 pr-2">
              {playlists.map((playlist) => (
                <Button
                  className="justify-start rounded-lg"
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

type LibraryViewProps = {
  onAddToPlaylist: (track: SpotifySavedTrack) => void;
  onPlay: (uri: string) => Promise<void> | void;
  onRemove: (trackId: string) => Promise<void> | void;
  pendingTrackId: string | null;
  savedTracks: SpotifySavedTrack[];
};

function LibraryView({
  onAddToPlaylist,
  onPlay,
  onRemove,
  pendingTrackId,
  savedTracks,
}: LibraryViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Liked tracks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Stream from your global library, route into a crate, or remove what you&apos;ve outgrown.
          </p>
        </div>
        <Badge className="rounded-full" variant="secondary">
          {savedTracks.length} saved
        </Badge>
      </div>

      {savedTracks.length ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm">
          <ScrollArea className="h-[640px]">
            <Table className="[&_tr]:border-border/40">
              <TableHeader className="sticky top-0 z-10 bg-card/80 backdrop-blur-md">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    #
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Track
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Album
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Saved
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedTracks.map((item, index) => (
                  <TableRow
                    className="group/row transition-colors hover:bg-[var(--color-elevated-highlight)]/40"
                    key={item.track.id}
                  >
                    <TableCell className="text-center text-sm text-muted-foreground">
                      <span className="group-hover/row:hidden">{index + 1}</span>
                      <button
                        aria-label={`Play ${item.track.name}`}
                        className="hidden text-foreground group-hover/row:inline-flex"
                        onClick={() => void onPlay(item.track.uri)}
                        type="button"
                      >
                        <PlayIcon className="size-4 fill-current" />
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex items-center gap-3">
                        <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                          {item.track.album.images[0]?.url ? (
                            <Image
                              alt={item.track.album.name}
                              className="object-cover"
                              fill
                              sizes="44px"
                              src={item.track.album.images[0].url}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.track.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.track.artists.map((artist) => artist.name).join(", ")}
                            <span className="mx-1.5">·</span>
                            {formatDuration(item.track.duration_ms)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {item.track.album.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeDate(item.added_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5 opacity-70 transition-opacity group-hover/row:opacity-100">
                        <Button
                          className="rounded-full"
                          onClick={() => void onPlay(item.track.uri)}
                          size="sm"
                          variant="ghost"
                        >
                          <AudioLinesIcon data-icon="inline-start" />
                          Play
                        </Button>
                        <Button
                          className="rounded-full"
                          disabled={pendingTrackId === item.track.id}
                          onClick={() => onAddToPlaylist(item)}
                          size="sm"
                          variant="ghost"
                        >
                          <PlusIcon data-icon="inline-start" />
                          Add
                        </Button>
                        <Button
                          className="rounded-full text-muted-foreground hover:text-destructive"
                          disabled={pendingTrackId === item.track.id}
                          onClick={() => void onRemove(item.track.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <HeartIcon className="fill-current" data-icon="inline-start" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      ) : (
        <Empty className="rounded-2xl border-border/50 bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LibraryBigIcon />
            </EmptyMedia>
            <EmptyTitle>No saved tracks yet</EmptyTitle>
            <EmptyDescription>
              Once your provider returns saved tracks, they will land here with playback and playlist actions.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

type DupsViewProps = {
  duplicateGroups: DuplicateTrackGroup[];
  onAddToPlaylist: (track: SpotifySavedTrack) => void;
  onPlay: (uri: string) => Promise<void> | void;
  onRemove: (trackId: string) => Promise<void> | void;
  pendingTrackId: string | null;
};

function DupsView({
  duplicateGroups,
  onAddToPlaylist,
  onPlay,
  onRemove,
  pendingTrackId,
}: DupsViewProps) {
  const duplicateTrackCount = duplicateGroups.reduce(
    (total, group) => total + group.tracks.length,
    0
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Duplicate songs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Songs with the same title and primary artist across saved albums, singles, remasters, and re-releases.
          </p>
        </div>
        <Badge className="rounded-full" variant="secondary">
          {duplicateGroups.length} groups · {duplicateTrackCount} tracks
        </Badge>
      </div>

      {duplicateGroups.length ? (
        <div className="flex flex-col gap-4">
          {duplicateGroups.map((group) => (
            <section
              className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm"
              key={group.key}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{group.title}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {group.primaryArtist}
                  </p>
                </div>
                <Badge className="rounded-full" variant="outline">
                  {group.tracks.length} versions
                </Badge>
              </div>
              <ScrollArea className="max-h-[420px]">
                <Table className="[&_tr]:border-border/40">
                  <TableHeader className="sticky top-0 z-10 bg-card/80 backdrop-blur-md">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        #
                      </TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Track
                      </TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Album
                      </TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Saved
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.tracks.map((item, index) => (
                      <TableRow
                        className="group/row transition-colors hover:bg-[var(--color-elevated-highlight)]/40"
                        key={`${item.track.id}-${item.added_at}`}
                      >
                        <TableCell className="text-center text-sm text-muted-foreground">
                          <span className="group-hover/row:hidden">{index + 1}</span>
                          <button
                            aria-label={`Play ${item.track.name}`}
                            className="hidden text-foreground group-hover/row:inline-flex"
                            onClick={() => void onPlay(item.track.uri)}
                            type="button"
                          >
                            <PlayIcon className="size-4 fill-current" />
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="flex items-center gap-3">
                            <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                              {item.track.album.images[0]?.url ? (
                                <Image
                                  alt={item.track.album.name}
                                  className="object-cover"
                                  fill
                                  sizes="44px"
                                  src={item.track.album.images[0].url}
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.track.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.track.artists.map((artist) => artist.name).join(", ")}
                                <span className="mx-1.5">·</span>
                                {formatDuration(item.track.duration_ms)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {item.track.album.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelativeDate(item.added_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5 opacity-70 transition-opacity group-hover/row:opacity-100">
                            <Button
                              className="rounded-full"
                              onClick={() => void onPlay(item.track.uri)}
                              size="sm"
                              variant="ghost"
                            >
                              <AudioLinesIcon data-icon="inline-start" />
                              Play
                            </Button>
                            <Button
                              className="rounded-full"
                              disabled={pendingTrackId === item.track.id}
                              onClick={() => onAddToPlaylist(item)}
                              size="sm"
                              variant="ghost"
                            >
                              <PlusIcon data-icon="inline-start" />
                              Add
                            </Button>
                            <Button
                              className="rounded-full text-muted-foreground hover:text-destructive"
                              disabled={pendingTrackId === item.track.id}
                              onClick={() => void onRemove(item.track.id)}
                              size="sm"
                              variant="ghost"
                            >
                              <HeartIcon className="fill-current" data-icon="inline-start" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </section>
          ))}
        </div>
      ) : (
        <Empty className="rounded-2xl border-border/50 bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CopyIcon />
            </EmptyMedia>
            <EmptyTitle>No duplicate songs found</EmptyTitle>
            <EmptyDescription>
              Your saved tracks do not currently include songs with the same title and primary artist.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

type PlaylistsViewProps = {
  activeTrackUri: string | null;
  isDetailLoading: boolean;
  onBack: () => void;
  onCreateClick: () => void;
  onLoadMore: () => void;
  onOpenPlaylist: (playlistId: string) => void;
  onPausePlayback: () => Promise<void> | void;
  onPlayPlaylist: (uri: string) => Promise<void> | void;
  onPlayTrack: (uri: string) => Promise<void> | void;
  onRemoveTrack: (playlistId: string, trackUri: string) => Promise<void> | void;
  pendingTrackUri: string | null;
  playlistItems: SpotifyPlaylistItem[];
  playlistItemsPage: SpotifyPagedResponse<SpotifyPlaylistItem> | null;
  playlists: SpotifyPlaylist[];
  selectedPlaylist: SpotifyPlaylist | null;
  spotlightPlaylistId: string | null;
};

function PlaylistsView({
  activeTrackUri,
  isDetailLoading,
  onBack,
  onCreateClick,
  onLoadMore,
  onOpenPlaylist,
  onPausePlayback,
  onPlayPlaylist,
  onPlayTrack,
  onRemoveTrack,
  pendingTrackUri,
  playlistItems,
  playlistItemsPage,
  playlists,
  selectedPlaylist,
  spotlightPlaylistId,
}: PlaylistsViewProps) {
  if (selectedPlaylist) {
    const visibleTracks = playlistItems.filter((item) => item.track);

    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button className="rounded-full" onClick={onBack} size="sm" variant="ghost">
            <ArrowLeftIcon data-icon="inline-start" />
            Playlists
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              disabled={!selectedPlaylist.tracks.total}
              onClick={() => void onPlayPlaylist(selectedPlaylist.uri)}
              size="sm"
              variant="secondary"
            >
              <PlayIcon className="fill-current" data-icon="inline-start" />
              Play
            </Button>
            {selectedPlaylist.external_urls?.spotify ? (
              <Button
                className="rounded-full"
                nativeButton={false}
                render={
                  <a
                    href={selectedPlaylist.external_urls.spotify}
                    rel="noreferrer"
                    target="_blank"
                  />
                }
                size="sm"
                variant="outline"
              >
                <ExternalLinkIcon data-icon="inline-start" />
                Spotify
              </Button>
            ) : null}
          </div>
        </div>

        <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="card-shelf flex flex-col gap-4 self-start">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted shadow-[0_18px_38px_-12px_rgba(0,0,0,0.6)]">
              {selectedPlaylist.images?.[0]?.url ? (
                <Image
                  alt={selectedPlaylist.name}
                  className="object-cover"
                  fill
                  sizes="280px"
                  src={selectedPlaylist.images[0].url}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-muted text-muted-foreground">
                  <ListMusicIcon className="size-10" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{selectedPlaylist.name}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedPlaylist.description || "Private crate ready for cross-service library sync and sequencing."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-full" variant="secondary">
                {selectedPlaylist.tracks.total} tracks
              </Badge>
              <Badge className="rounded-full" variant="outline">
                {selectedPlaylist.collaborative ? "Collaborative" : "Private"}
              </Badge>
              <Badge className="rounded-full" variant="outline">
                {selectedPlaylist.public ? "Public" : "Hidden"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Owner: {selectedPlaylist.owner.display_name ?? "Spotify user"}
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm">
            {visibleTracks.length ? (
              <>
                <ScrollArea className="h-[640px]">
                  <Table className="[&_tr]:border-border/40">
                    <TableHeader className="sticky top-0 z-10 bg-card/80 backdrop-blur-md">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          #
                        </TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Track
                        </TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Album
                        </TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Added
                        </TableHead>
                        <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleTracks.map((item, index) => {
                        const track = item.track;

                        if (!track) {
                          return null;
                        }

                        return (
                          <TableRow
                            className="group/row transition-colors hover:bg-[var(--color-elevated-highlight)]/40"
                            key={`${track.uri}-${index}`}
                          >
                            <TableCell className="text-center text-sm text-muted-foreground">
                              <div className="flex h-7 w-7 items-center justify-center">
                                {activeTrackUri === track.uri ? (
                                  <button
                                    aria-label={`Pause ${track.name}`}
                                    className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                                    onClick={() => void onPausePlayback()}
                                    type="button"
                                  >
                                    <PauseIcon className="size-4 fill-current" />
                                  </button>
                                ) : (
                                  <>
                                    <span className="group-hover/row:hidden">{index + 1}</span>
                                    <button
                                      aria-label={`Play ${track.name}`}
                                      className="hidden size-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted group-hover/row:flex"
                                      onClick={() => void onPlayTrack(track.uri)}
                                      type="button"
                                    >
                                      <PlayIcon className="size-4 fill-current" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              <div className="flex items-center gap-3">
                                <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                                  {track.album.images[0]?.url ? (
                                    <Image
                                      alt={track.album.name}
                                      className="object-cover"
                                      fill
                                      sizes="44px"
                                      src={track.album.images[0].url}
                                    />
                                  ) : (
                                    <AlbumIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate font-medium">{track.name}</p>
                                    {track.explicit ? (
                                      <Badge className="rounded-full" variant="outline">
                                        Explicit
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {track.artists.map((artist) => artist.name).join(", ")}
                                    <span className="mx-1.5">·</span>
                                    {formatDuration(track.duration_ms)}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                              {track.album.name}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.added_at ? formatRelativeDate(item.added_at) : "Unknown"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1.5 opacity-70 transition-opacity group-hover/row:opacity-100">
                                <Button
                                  className="rounded-full text-muted-foreground hover:text-destructive"
                                  disabled={pendingTrackUri === track.uri}
                                  onClick={() =>
                                    void onRemoveTrack(selectedPlaylist.id, track.uri)
                                  }
                                  size="sm"
                                  variant="ghost"
                                >
                                  <Trash2Icon data-icon="inline-start" />
                                  Remove
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {playlistItemsPage?.next ? (
                  <div className="flex justify-center border-t border-border/60 p-3">
                    <Button
                      className="rounded-full"
                      disabled={isDetailLoading}
                      onClick={onLoadMore}
                      size="sm"
                      variant="secondary"
                    >
                      {isDetailLoading ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <Empty className="border-0 bg-transparent py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ListMusicIcon />
                  </EmptyMedia>
                  <EmptyTitle>
                    {isDetailLoading ? "Loading playlist tracks" : "No tracks available"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {isDetailLoading
                      ? "The playlist contents are loading from Spotify."
                      : "This playlist is empty or Spotify did not return playable tracks."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Crate playlists</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Private playlists you can route saved tracks into. Click the + on the sidebar or below to make a new one.
          </p>
        </div>
        <Button className="rounded-full" onClick={onCreateClick} size="sm" variant="secondary">
          <PlusIcon data-icon="inline-start" />
          New playlist
        </Button>
      </div>

      {playlists.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {playlists.map((playlist) => (
            <article
              className={`card-shelf flex cursor-pointer flex-col gap-4 transition-colors hover:border-primary/45 ${
                spotlightPlaylistId === playlist.id
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : ""
              }`}
              key={playlist.id}
              onClick={() => onOpenPlaylist(playlist.id)}
            >
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted shadow-[0_18px_38px_-12px_rgba(0,0,0,0.6)]">
                {playlist.images?.[0]?.url ? (
                  <Image
                    alt={playlist.name}
                    className="object-cover"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    src={playlist.images[0].url}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-muted text-muted-foreground">
                    <ListMusicIcon className="size-10" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="truncate text-base font-semibold">{playlist.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {playlist.description || "Private crate ready for cross-service library sync and sequencing."}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-2">
                <Badge className="rounded-full" variant="secondary">
                  {playlist.tracks.total} tracks
                </Badge>
                <Badge className="rounded-full" variant="outline">
                  {playlist.collaborative ? "Collaborative" : "Private"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  className="rounded-full"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onPlayPlaylist(playlist.uri);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  <PlayIcon className="fill-current" data-icon="inline-start" />
                  Play
                </Button>
                {playlist.external_urls?.spotify ? (
                  <Button
                    className="rounded-full"
                    nativeButton={false}
                    onClick={(event) => event.stopPropagation()}
                    render={
                      <a
                        href={playlist.external_urls.spotify}
                        rel="noreferrer"
                        target="_blank"
                      />
                    }
                    size="sm"
                    variant="outline"
                  >
                    <ExternalLinkIcon data-icon="inline-start" />
                    Open
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty className="rounded-2xl border-border/50 bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListMusicIcon />
            </EmptyMedia>
            <EmptyTitle>No playlists available</EmptyTitle>
            <EmptyDescription>
              Create your first crate and start routing tracks into it from your global library.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

type SyncViewProps = {
  browserDeviceId: string | null;
};

function SyncView({ browserDeviceId }: SyncViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sync</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connected providers feed your global library. New sources can be added as they come online.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Source status</CardTitle>
            <CardDescription>Connected providers are syncing into your global library.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="rounded-full">Connected</Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Crate workflow</CardTitle>
            <CardDescription>
              Save → group → curate. Multi-service sync arrives in a future milestone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              v1 focuses on auth, playback, library control, and playlist management without inventing sync rules yet.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Dashboard state</CardTitle>
            <CardDescription>
              Ready for webhook and query-driven library updates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="rounded-full" variant="secondary">
              {browserDeviceId ? "Browser player online" : "Waiting for browser player"}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
