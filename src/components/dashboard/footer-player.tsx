"use client";

import {
  AlertCircleIcon,
  CarIcon,
  ChevronUpIcon,
  Gamepad2Icon,
  Loader2Icon,
  MonitorIcon,
  PauseIcon,
  PlayIcon,
  RadioIcon,
  SmartphoneIcon,
  SpeakerIcon,
  SkipBackIcon,
  SkipForwardIcon,
  TvIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { formatDuration } from "@/lib/format";
import type {
  SpotifyDevice,
  SpotifyPlaybackState,
  SpotifyPlayerResponse,
  SpotifyTrack,
} from "@/lib/spotify-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { musicKeys } from "@/lib/music-query-keys";
import type { MusicService } from "@/lib/music-services";
import { cn } from "@/lib/utils";

const BROWSER_PLAYER_NAME = "OneMusicCrate Web Player";

const DEVICE_TYPE_ICONS: Record<string, LucideIcon> = {
  computer: MonitorIcon,
  smartphone: SmartphoneIcon,
  tablet: SmartphoneIcon,
  speaker: SpeakerIcon,
  tv: TvIcon,
  castvideo: TvIcon,
  castaudio: SpeakerIcon,
  gameconsole: Gamepad2Icon,
  automobile: CarIcon,
};

function getDeviceIcon(type: string | undefined): LucideIcon {
  if (!type) {
    return RadioIcon;
  }

  return DEVICE_TYPE_ICONS[type.toLowerCase()] ?? RadioIcon;
}

const VISIBLE_POLL_INTERVAL_MS = 5_000;
const HIDDEN_POLL_INTERVAL_MS = 15_000;
const FAST_POLL_INTERVAL_MS = 2_000;
const FAST_POLL_WINDOW_MS = 12_000;
const TIMER_TICK_INTERVAL_MS = 500;
const POSITION_AHEAD_RESET_MS = 1_000;
const POSITION_DRIFT_RESET_MS = 2_500;

type FooterPlayerProps = {
  className?: string;
  initialPlayback: SpotifyPlaybackState | null;
  onDeviceChange: (deviceId: string | null) => void;
  onPlaybackChange: (playback: SpotifyPlaybackState | null) => void;
  service: MusicService;
};

type PlaybackClock = {
  trackUri: string | null;
  deviceId: string | null;
  basePositionMs: number;
  baseMonotonicMs: number;
  durationMs: number;
  isPlaying: boolean;
};

async function postPlayerAction(service: MusicService, body: Record<string, unknown>) {
  const response = await fetch(`/api/music/services/${service}/player`, {
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

    throw new Error(payload?.error ?? "Player request failed.");
  }
}

async function fetchPlayerState(service: MusicService) {
  const response = await fetch(`/api/music/services/${service}/player`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(payload?.error ?? "Unable to refresh player state.");
  }

  return (await response.json()) as SpotifyPlayerResponse;
}

function getSliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? (value[0] ?? 0) : value;
}

function getMonotonicNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function clampPosition(positionMs: number, durationMs: number) {
  return Math.min(Math.max(0, positionMs), Math.max(0, durationMs));
}

function createPlaybackClock(
  playback: SpotifyPlaybackState | null,
  nowMs: number
): PlaybackClock {
  if (!playback) {
    return {
      baseMonotonicMs: nowMs,
      basePositionMs: 0,
      deviceId: null,
      durationMs: 0,
      isPlaying: false,
      trackUri: null,
    };
  }

  const baseProgress = playback.progress_ms ?? 0;
  const durationMs = playback.item?.duration_ms ?? baseProgress;

  return {
    baseMonotonicMs: nowMs,
    basePositionMs: clampPosition(baseProgress, durationMs),
    deviceId: playback.device.id,
    durationMs,
    isPlaying: playback.is_playing,
    trackUri: playback.item?.uri ?? null,
  };
}

function getClockPosition(clock: PlaybackClock, nowMs: number) {
  if (!clock.isPlaying) {
    return clampPosition(clock.basePositionMs, clock.durationMs);
  }

  return clampPosition(
    clock.basePositionMs + Math.max(0, nowMs - clock.baseMonotonicMs),
    clock.durationMs
  );
}

function reconcilePlaybackClock(
  currentClock: PlaybackClock,
  playback: SpotifyPlaybackState | null,
  nowMs: number
) {
  const nextClock = createPlaybackClock(playback, nowMs);
  const currentPositionMs = getClockPosition(currentClock, nowMs);
  const positionDriftMs = currentPositionMs - nextClock.basePositionMs;
  const shouldReset =
    currentClock.trackUri !== nextClock.trackUri ||
    currentClock.deviceId !== nextClock.deviceId ||
    currentClock.isPlaying !== nextClock.isPlaying ||
    positionDriftMs > POSITION_AHEAD_RESET_MS ||
    Math.abs(positionDriftMs) > POSITION_DRIFT_RESET_MS;

  if (shouldReset) {
    return nextClock;
  }

  return {
    ...currentClock,
    durationMs: nextClock.durationMs,
  };
}

function hasActiveTrackPlayback(playback: SpotifyPlaybackState | null) {
  return Boolean(playback?.item);
}

function normalizeSdkTrack(track: Spotify.WebPlaybackTrack): SpotifyTrack {
  return {
    id: track.id ?? track.uri,
    name: track.name,
    uri: track.uri,
    duration_ms: track.duration_ms,
    explicit: false,
    preview_url: null,
    album: {
      id: track.album.uri,
      name: track.album.name,
      images: track.album.images.map((image) => ({
        height: null,
        url: image.url,
        width: null,
      })),
      uri: track.album.uri,
    },
    artists: track.artists.map((artist) => ({
      id: artist.uri,
      name: artist.name,
      uri: artist.uri,
    })),
  };
}

export function FooterPlayer({
  className,
  initialPlayback,
  onDeviceChange,
  onPlaybackChange,
  service,
}: FooterPlayerProps) {
  const queryClient = useQueryClient();
  const playerRef = useRef<Spotify.Player | null>(null);
  const activeDeviceRef = useRef<SpotifyDevice | null>(
    initialPlayback?.device ?? null
  );
  const availableDevicesRef = useRef<SpotifyDevice[]>([]);
  const deviceIdRef = useRef<string | null>(null);
  const fastPollUntilRef = useRef(0);
  const volumeRef = useRef(initialPlayback?.device.volume_percent ?? 70);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [livePlayback, setLivePlayback] =
    useState<SpotifyPlaybackState | null>(initialPlayback);
  const [availableDevices, setAvailableDevices] = useState<SpotifyDevice[]>([]);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBrowserPlayerReady, setIsBrowserPlayerReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isDismissed, setIsDismissed] = useState(!initialPlayback?.item);
  const [pollVersion, setPollVersion] = useState(0);
  const [playbackClock, setPlaybackClock] = useState(() =>
    createPlaybackClock(initialPlayback, getMonotonicNow())
  );
  const [displayPositionMs, setDisplayPositionMs] = useState(() =>
    getClockPosition(playbackClock, getMonotonicNow())
  );
  const [scrubPositionMs, setScrubPositionMs] = useState<number | null>(null);
  const [volume, setVolume] = useState(
    initialPlayback?.device.volume_percent ?? 70
  );
  const playerActionMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => postPlayerAction(service, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: musicKeys.player(service) }),
  });

  const refreshPlayerState = useCallback(async ({ silent = false } = {}) => {
    try {
      const payload = await queryClient.fetchQuery({
        queryKey: musicKeys.player(service),
        queryFn: () => fetchPlayerState(service),
        staleTime: 0,
      });

      setLivePlayback(payload.playback);
      activeDeviceRef.current = payload.playback?.device ?? null;
      setAvailableDevices(payload.devices);
      availableDevicesRef.current = payload.devices;
      setPlaybackClock((currentClock) =>
        reconcilePlaybackClock(currentClock, payload.playback, getMonotonicNow())
      );

      if (typeof payload.playback?.device.volume_percent === "number") {
        setVolume(payload.playback.device.volume_percent);
        volumeRef.current = payload.playback.device.volume_percent;
      }

      return payload;
    } catch (error) {
      if (!silent) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to refresh player state."
        );
      }

      return null;
    }
  }, [queryClient, service]);

  useEffect(() => {
    availableDevicesRef.current = availableDevices;
  }, [availableDevices]);

  useEffect(() => {
    onPlaybackChange(livePlayback);
  }, [livePlayback, onPlaybackChange]);

  useEffect(() => {
    if (hasActiveTrackPlayback(livePlayback)) {
      setIsDismissed(false);
    }
  }, [livePlayback?.item?.uri]);

  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    let isCancelled = false;

    async function fetchToken() {
      const response = await fetch("/api/spotify/player/token", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to fetch a playback token.");
      }

      const payload = (await response.json()) as { accessToken: string };

      return payload.accessToken;
    }

    function registerPlayer() {
      if (!window.Spotify || isCancelled) {
        return;
      }

      const player = new window.Spotify.Player({
        name: "OneMusicCrate Web Player",
        volume: 0.7,
        getOAuthToken: async (callback) => {
          try {
            callback(await fetchToken());
          } catch (error) {
            setSdkError(
              error instanceof Error
                ? error.message
                : "Unable to load the playback SDK token."
            );
          }
        },
      });

      playerRef.current = player;

      player.addListener("ready", (event) => {
        if (!event || !("device_id" in event)) {
          return;
        }

        deviceIdRef.current = event.device_id;
        setDeviceId(event.device_id);
        setIsBrowserPlayerReady(true);
        setSdkError(null);
        onDeviceChange(event.device_id);
      });

      player.addListener("not_ready", () => {
        setIsBrowserPlayerReady(false);
        deviceIdRef.current = null;
        setDeviceId(null);
        onDeviceChange(null);
      });

      player.addListener("player_state_changed", (event) => {
        if (!event || !("track_window" in event)) {
          return;
        }

        const browserDeviceId = deviceIdRef.current;
        const activeDevice = activeDeviceRef.current;

        if (
          activeDevice &&
          browserDeviceId &&
          activeDevice.id !== browserDeviceId &&
          activeDevice.name !== "OneMusicCrate Web Player"
        ) {
          return;
        }

        const browserDevice = browserDeviceId
          ? availableDevicesRef.current.find(
              (device) => device.id === browserDeviceId
            )
          : null;

        const nextPlayback: SpotifyPlaybackState = {
          currently_playing_type: "track",
          device: browserDevice ?? {
            id: browserDeviceId,
            is_active: true,
            is_private_session: false,
            is_restricted: false,
            name: "OneMusicCrate Web Player",
            supports_volume: true,
            type: "Computer",
            volume_percent: volumeRef.current,
          },
          is_playing: !event.paused,
          item: normalizeSdkTrack(event.track_window.current_track),
          progress_ms: event.position,
          repeat_state: "off",
          shuffle_state: false,
          timestamp: Date.now(),
        };

        activeDeviceRef.current = nextPlayback.device;
        setLivePlayback(nextPlayback);
        setPlaybackClock(createPlaybackClock(nextPlayback, getMonotonicNow()));
      });

      for (const eventName of [
        "initialization_error",
        "authentication_error",
        "account_error",
        "playback_error",
      ] as const) {
        player.addListener(eventName, (event) => {
          if (!event || !("message" in event)) {
            return;
          }

          setSdkError(event.message);
        });
      }

      void player.connect();
    }

    if (window.Spotify) {
      registerPlayer();
    } else {
      const existingScript = document.getElementById("spotify-player-sdk");

      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "spotify-player-sdk";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }

      window.onSpotifyWebPlaybackSDKReady = registerPlayer;
    }

    return () => {
      isCancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [onDeviceChange, onPlaybackChange]);

  useEffect(() => {
    let timeoutId: number | undefined;
    let isCancelled = false;

    async function poll() {
      await refreshPlayerState({ silent: true });

      if (isCancelled) {
        return;
      }

      const isFastPolling = Date.now() < fastPollUntilRef.current;
      const intervalMs = isFastPolling
        ? FAST_POLL_INTERVAL_MS
        : document.visibilityState === "hidden"
          ? HIDDEN_POLL_INTERVAL_MS
          : VISIBLE_POLL_INTERVAL_MS;

      timeoutId = window.setTimeout(() => void poll(), intervalMs);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fastPollUntilRef.current = Date.now() + FAST_POLL_WINDOW_MS;
        setPollVersion((current) => current + 1);
        void refreshPlayerState({ silent: true });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void poll();

    return () => {
      isCancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pollVersion, refreshPlayerState]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDisplayPositionMs(getClockPosition(playbackClock, getMonotonicNow()));
    }, TIMER_TICK_INTERVAL_MS);

    setDisplayPositionMs(getClockPosition(playbackClock, getMonotonicNow()));

    return () => window.clearInterval(interval);
  }, [playbackClock]);

  const currentTrack = livePlayback?.item ?? null;
  const activeDevice = livePlayback?.device ?? null;
  const activeDeviceId = activeDevice?.id ?? undefined;
  const activeListedDevice =
    availableDevices.find((device) => device.is_active) ?? null;
  const fallbackDeviceId = activeDevice
    ? activeDeviceId
    : activeListedDevice
      ? activeListedDevice.id ?? undefined
      : deviceId ?? undefined;
  const hasPlaybackTarget = Boolean(
    activeDevice ?? activeListedDevice ?? deviceId
  );

  const isPlaying = livePlayback?.is_playing ?? false;
  const playbackDuration = currentTrack?.duration_ms ?? 0;
  const visiblePositionMs = scrubPositionMs ?? displayPositionMs;
  const hasTrackPlayback = hasActiveTrackPlayback(livePlayback);

  async function runAction(body: Record<string, unknown>) {
    try {
      setIsBusy(true);
      await playerActionMutation.mutateAsync(body);
      fastPollUntilRef.current = Date.now() + FAST_POLL_WINDOW_MS;
      setPollVersion((current) => current + 1);
      await refreshPlayerState();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Player action failed."
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function seekToPosition(positionMs: number) {
    const nextPositionMs = clampPosition(positionMs, playbackDuration);

    setPlaybackClock((currentClock) => ({
      ...currentClock,
      baseMonotonicMs: getMonotonicNow(),
      basePositionMs: nextPositionMs,
    }));
    setScrubPositionMs(null);

    await runAction({
      action: "seek",
      deviceId: fallbackDeviceId,
      positionMs: nextPositionMs,
    });
  }

  async function connectBrowserPlayer() {
    if (!deviceId) {
      toast.error("The browser player is not ready yet.");
      return;
    }

    try {
      setIsConnecting(true);
      await playerRef.current?.activateElement?.();
      await runAction({
        action: "transfer",
        deviceId,
        play: false,
      });
      toast.success("Playback transferred to this browser.");
    } finally {
      setIsConnecting(false);
    }
  }

  const artistLine =
    currentTrack?.artists.map((artist) => artist.name).join(", ") ?? "";

  const isRemotePlayback = Boolean(
    hasTrackPlayback &&
    activeDevice && activeDevice.name !== BROWSER_PLAYER_NAME
  );
  const RemoteDeviceIcon = getDeviceIcon(activeDevice?.type);

  return (
    <div
      className={cn(
        "sticky bottom-0 z-40 border-t border-border/50 bg-[var(--player-surface)]/95 shadow-[0_-12px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-transform duration-300 ease-out",
        isDismissed
          ? "translate-y-[calc(100%-var(--player-peek-height))]"
          : "translate-y-0",
        className
      )}
    >
      {isDismissed ? (
        <button
          aria-expanded={false}
          aria-label="Expand player"
          className="flex w-full items-center justify-between gap-3 border-b border-border/40 bg-[var(--player-surface-strong)]/90 px-4 py-2 text-left sm:px-6"
          onClick={() => setIsDismissed(false)}
          type="button"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="h-1.5 w-10 rounded-full bg-foreground/20"
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Player
              </p>
              <p className="truncate text-xs text-foreground/90">
                {currentTrack?.name ?? "Nothing playing"}
              </p>
            </div>
          </div>
          <ChevronUpIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
        </button>
      ) : (
        <div className="flex items-center justify-center border-b border-border/40 bg-[var(--player-surface-strong)]/90 px-4 py-2 sm:px-6">
          <span
            aria-hidden
            className="h-1.5 w-10 rounded-full bg-foreground/20"
          />
        </div>
      )}

      <div
        aria-hidden={isDismissed}
        className={[
          "transition-opacity duration-200",
          isDismissed ? "pointer-events-none opacity-0" : "opacity-100",
        ].join(" ")}
      >
      {isRemotePlayback && activeDevice ? (
        <div className="relative overflow-hidden border-b border-primary/20">
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/[0.06] to-transparent"
          />
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-primary/40 via-primary to-primary/40"
          />
          <div className="relative flex items-center justify-between gap-3 px-4 py-2 pl-5 sm:px-6 sm:pl-7">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex size-3 shrink-0 items-center justify-center">
                <span className="absolute inline-flex size-3 animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  Streaming on
                </span>
                <span
                  aria-hidden
                  className="hidden h-3 w-px bg-primary/30 sm:inline-block"
                />
                <RemoteDeviceIcon
                  aria-hidden
                  className="hidden size-3.5 shrink-0 text-foreground/70 sm:inline-block"
                />
                <span className="truncate text-xs font-medium text-foreground/95">
                  {activeDevice.name}
                </span>
                {activeDevice.type ? (
                  <span className="hidden rounded-sm border border-foreground/10 bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/60 md:inline-block">
                    {activeDevice.type}
                  </span>
                ) : null}
              </div>
            </div>
            <Button
              className="h-7 shrink-0 rounded-full px-3 text-[11px] font-medium tracking-wide hover:bg-primary/15 hover:text-primary"
              disabled={!deviceId || isConnecting || !isBrowserPlayerReady}
              onClick={() => void connectBrowserPlayer()}
              size="sm"
              variant="ghost"
            >
              {isConnecting ? (
                <Loader2Icon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <RadioIcon data-icon="inline-start" className="size-3.5" />
              )}
              <span className="hidden sm:inline">Play here instead</span>
              <span className="sm:hidden">Play here</span>
            </Button>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
          />
        </div>
      ) : null}

      {sdkError ? (
        <div className="border-b border-border/50 px-4 py-2 sm:px-6">
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Browser playback requires a Premium plan</AlertTitle>
            <AlertDescription>{sdkError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="relative grid grid-cols-1 items-center gap-3 px-4 py-3 pr-14 sm:px-6 sm:pr-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        <Button
          aria-label="Hide player"
          className="absolute right-4 top-3 rounded-full border-border/50 bg-background/70 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground sm:right-6"
          onClick={() => setIsDismissed(true)}
          size="icon-sm"
          variant="outline"
        >
          <XIcon className="size-4" />
        </Button>

        {/* LEFT — current track */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted shadow-[0_8px_18px_-6px_rgba(0,0,0,0.6)]">
            {currentTrack?.album.images[0]?.url ? (
              <Image
                alt={currentTrack.album.name}
                className="object-cover"
                fill
                sizes="56px"
                src={currentTrack.album.images[0].url}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <PlayIcon className="size-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {currentTrack?.name ?? "Nothing playing"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {artistLine ||
                "Connect the browser player or pick a track from your library."}
            </p>
          </div>
        </div>

        {/* CENTER — transport + scrubber */}
        <div className="flex w-full flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            <Button
              className="rounded-full text-muted-foreground hover:text-foreground"
              disabled={isBusy || !hasPlaybackTarget}
              onClick={() =>
                void runAction({
                  action: "previous",
                  deviceId: fallbackDeviceId,
                })
              }
              size="icon-sm"
              variant="ghost"
            >
              <SkipBackIcon />
            </Button>
            <Button
              aria-label={isPlaying ? "Pause" : "Play"}
              className="size-10 rounded-full bg-foreground text-background hover:bg-foreground"
              disabled={isBusy || !hasPlaybackTarget}
              onClick={() =>
                void runAction({
                  action: isPlaying ? "pause" : "resume",
                  deviceId: fallbackDeviceId,
                })
              }
              size="icon"
            >
              {isBusy ? (
                <Loader2Icon className="animate-spin" />
              ) : isPlaying ? (
                <PauseIcon className="fill-current" />
              ) : (
                <PlayIcon className="fill-current" />
              )}
            </Button>
            <Button
              className="rounded-full text-muted-foreground hover:text-foreground"
              disabled={isBusy || !hasPlaybackTarget}
              onClick={() =>
                void runAction({
                  action: "next",
                  deviceId: fallbackDeviceId,
                })
              }
              size="icon-sm"
              variant="ghost"
            >
              <SkipForwardIcon />
            </Button>
          </div>

          <div className="flex w-full max-w-2xl items-center gap-2.5 text-xs">
            <span className="w-10 text-right tabular-nums text-muted-foreground">
              {formatDuration(visiblePositionMs)}
            </span>
            <Slider
              disabled={!hasPlaybackTarget || !playbackDuration}
              max={playbackDuration || 1}
              min={0}
              onValueCommitted={(values) =>
                void seekToPosition(getSliderValue(values))
              }
              onValueChange={(values) =>
                setScrubPositionMs(getSliderValue(values))
              }
              value={[visiblePositionMs]}
            />
            <span className="w-10 tabular-nums text-muted-foreground">
              {formatDuration(playbackDuration)}
            </span>
          </div>
        </div>

        {/* RIGHT — volume */}
        <div className="flex items-center justify-end gap-3">
          <div className="flex w-32 items-center gap-2">
            <Volume2Icon className="size-4 text-muted-foreground" />
            <Slider
              disabled={!hasPlaybackTarget}
              max={100}
              min={0}
              onValueCommitted={(values) =>
                void runAction({
                  action: "volume",
                  deviceId: fallbackDeviceId,
                  volumePercent: getSliderValue(values),
                })
              }
              onValueChange={(values) => setVolume(getSliderValue(values))}
              value={[volume]}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
