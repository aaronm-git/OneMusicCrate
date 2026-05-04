"use client";

import {
  AlertCircleIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  SpeakerIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { formatDuration } from "@/lib/format";
import type { SpotifyPlaybackState } from "@/lib/spotify-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

type FooterPlayerProps = {
  initialPlayback: SpotifyPlaybackState | null;
  onDeviceChange: (deviceId: string | null) => void;
};

async function postPlayerAction(body: Record<string, unknown>) {
  const response = await fetch("/api/spotify/player", {
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

    throw new Error(payload?.error ?? "Spotify player request failed.");
  }
}

function getSliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? (value[0] ?? 0) : value;
}

export function FooterPlayer({
  initialPlayback,
  onDeviceChange,
}: FooterPlayerProps) {
  const playerRef = useRef<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sdkState, setSdkState] = useState<Spotify.PlaybackState | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBrowserPlayerReady, setIsBrowserPlayerReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [positionMs, setPositionMs] = useState(initialPlayback?.progress_ms ?? 0);
  const [volume, setVolume] = useState(
    initialPlayback?.device.volume_percent ?? 70
  );

  useEffect(() => {
    let isCancelled = false;

    async function fetchToken() {
      const response = await fetch("/api/spotify/player/token", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to fetch a Spotify playback token.");
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
                : "Unable to load the Spotify SDK token."
            );
          }
        },
      });

      playerRef.current = player;

      player.addListener("ready", (event) => {
        if (!event || !("device_id" in event)) {
          return;
        }

        setDeviceId(event.device_id);
        setIsBrowserPlayerReady(true);
        setSdkError(null);
        onDeviceChange(event.device_id);
      });

      player.addListener("not_ready", () => {
        setIsBrowserPlayerReady(false);
        setDeviceId(null);
        onDeviceChange(null);
      });

      player.addListener("player_state_changed", (event) => {
        if (!event || !("track_window" in event)) {
          return;
        }

        setSdkState(event);
        setPositionMs(event.position);
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
  }, [onDeviceChange]);

  useEffect(() => {
    if (!sdkState || sdkState.paused) {
      return;
    }

    const interval = window.setInterval(() => {
      setPositionMs((current) => Math.min(current + 1000, sdkState.duration));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sdkState]);

  const currentTrack = useMemo(() => {
    if (sdkState?.track_window.current_track) {
      return sdkState.track_window.current_track;
    }

    return initialPlayback?.item ?? null;
  }, [initialPlayback?.item, sdkState]);

  const isPlaying = sdkState ? !sdkState.paused : initialPlayback?.is_playing ?? false;
  const playbackDuration = sdkState?.duration ?? initialPlayback?.item?.duration_ms ?? 0;

  async function runAction(body: Record<string, unknown>) {
    try {
      setIsBusy(true);
      await postPlayerAction(body);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Spotify action failed."
      );
    } finally {
      setIsBusy(false);
    }
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

  const transportDeviceId = deviceId ?? initialPlayback?.device.id ?? undefined;

  return (
    <div className="sticky bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">
        {sdkError ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Browser playback needs Spotify Premium</AlertTitle>
            <AlertDescription>{sdkError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative size-14 overflow-hidden rounded-lg bg-muted">
              {currentTrack?.album.images[0]?.url ? (
                <Image
                  alt={currentTrack.album.name}
                  className="object-cover"
                  fill
                  sizes="56px"
                  src={currentTrack.album.images[0].url}
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {currentTrack?.name ?? "No track selected"}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {currentTrack?.artists.map((artist) => artist.name).join(", ") ??
                  "Connect the browser player or select a track from your library."}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary">
                  {isBrowserPlayerReady ? "Browser player ready" : "Browser player offline"}
                </Badge>
                <Badge variant="outline">
                  {initialPlayback?.device.name ?? "Spotify Connect"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 lg:max-w-2xl">
            <div className="flex items-center justify-center gap-2">
              <Button
                disabled={isBusy}
                onClick={() => void runAction({ action: "previous", deviceId: transportDeviceId })}
                size="icon-sm"
                variant="ghost"
              >
                <SkipBackIcon />
              </Button>
              <Button
                disabled={isBusy}
                onClick={() =>
                  void runAction({
                    action: isPlaying ? "pause" : "resume",
                    deviceId: transportDeviceId,
                  })
                }
                size="icon"
              >
                {isBusy ? <Loader2Icon className="animate-spin" /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => void runAction({ action: "next", deviceId: transportDeviceId })}
                size="icon-sm"
                variant="ghost"
              >
                <SkipForwardIcon />
              </Button>
              <Separator className="mx-1 hidden h-6 md:block" orientation="vertical" />
              <Button
                disabled={!deviceId || isConnecting}
                onClick={() => void connectBrowserPlayer()}
                variant="outline"
              >
                {isConnecting ? (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <SpeakerIcon data-icon="inline-start" />
                )}
                Connect browser
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-10 text-xs text-muted-foreground">
                {formatDuration(positionMs)}
              </span>
              <Slider
                max={playbackDuration || 1}
                min={0}
                onValueCommitted={(values) =>
                  void runAction({
                    action: "seek",
                    deviceId: transportDeviceId,
                    positionMs: getSliderValue(values),
                  })
                }
                onValueChange={(values) => setPositionMs(getSliderValue(values))}
                value={[positionMs]}
              />
              <span className="w-10 text-right text-xs text-muted-foreground">
                {formatDuration(playbackDuration)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:w-48">
            <Volume2Icon className="text-muted-foreground" />
            <Slider
              max={100}
              min={0}
              onValueCommitted={(values) =>
                void runAction({
                  action: "volume",
                  deviceId: transportDeviceId,
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
  );
}
