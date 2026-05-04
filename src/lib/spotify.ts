import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { getRequiredEnv } from "@/lib/env";
import type {
  SpotifyDevicesResponse,
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifyProfile,
  SpotifySavedTrack,
} from "@/lib/spotify-types";

const spotifyProviderId = "spotify";
const spotifyApiBaseUrl = "https://api.spotify.com/v1";
const spotifyTokenUrl = "https://accounts.spotify.com/api/token";

type SpotifyAccount = typeof accounts.$inferSelect;

async function getSpotifyAccount(userId: string) {
  const account = await getDb().query.accounts.findFirst({
    where: and(
      eq(accounts.userId, userId),
      eq(accounts.providerId, spotifyProviderId)
    ),
  });

  if (!account) {
    throw new Error("Spotify account not found for the current session.");
  }

  return account;
}

async function refreshSpotifyAccessToken(account: SpotifyAccount) {
  if (!account.refreshToken) {
    throw new Error("Spotify refresh token is missing.");
  }

  const basicAuth = Buffer.from(
    `${getRequiredEnv("SPOTIFY_CLIENT_ID")}:${getRequiredEnv("SPOTIFY_CLIENT_SECRET")}`
  ).toString("base64");

  const response = await fetch(spotifyTokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | {
        access_token?: string;
        expires_in?: number;
        refresh_token?: string;
        scope?: string;
        error?: string;
        error_description?: string;
      }
    | undefined;

  if (!response.ok || !payload?.access_token) {
    throw new Error(
      payload?.error_description ??
        payload?.error ??
        "Unable to refresh the Spotify access token."
    );
  }

  const nextExpiry = new Date(Date.now() + (payload.expires_in ?? 3600) * 1000);

  await getDb()
    .update(accounts)
    .set({
      accessToken: payload.access_token,
      accessTokenExpiresAt: nextExpiry,
      refreshToken: payload.refresh_token ?? account.refreshToken,
      scope: payload.scope ?? account.scope,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, account.id));

  return payload.access_token;
}

async function getSpotifyAccessToken(userId: string, forceRefresh = false) {
  const account = await getSpotifyAccount(userId);
  const expiresSoon =
    !account.accessTokenExpiresAt ||
    account.accessTokenExpiresAt.getTime() - Date.now() < 60_000;

  if (forceRefresh || expiresSoon || !account.accessToken) {
    return refreshSpotifyAccessToken(account);
  }

  return account.accessToken;
}

async function spotifyFetch<T>(
  userId: string,
  path: string,
  init: RequestInit = {},
  retryUnauthorized = true
) {
  const accessToken = await getSpotifyAccessToken(userId);
  const response = await fetch(`${spotifyApiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && retryUnauthorized) {
    await getSpotifyAccessToken(userId, true);
    return spotifyFetch<T>(userId, path, init, false);
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("content-type");
  const payload = contentType?.includes("application/json")
    ? ((await response.json()) as
        | T
        | { error?: { message?: string } }
        | undefined)
    : undefined;

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      payload.error?.message
        ? payload.error.message
        : "Spotify request failed.";

    throw new Error(message);
  }

  return payload as T;
}

export async function getSpotifySdkToken(userId: string) {
  return getSpotifyAccessToken(userId);
}

export async function getSpotifyProfile(userId: string) {
  return spotifyFetch<SpotifyProfile>(userId, "/me");
}

export async function getSavedTracks(userId: string, limit = 20) {
  const response = await spotifyFetch<{ items: SpotifySavedTrack[] }>(
    userId,
    `/me/tracks?limit=${limit}`
  );

  return response.items;
}

export async function getPlaylists(userId: string, limit = 12) {
  const response = await spotifyFetch<{ items: SpotifyPlaylist[] }>(
    userId,
    `/me/playlists?limit=${limit}`
  );

  return response.items;
}

export async function getCurrentPlayback(userId: string) {
  return spotifyFetch<SpotifyPlaybackState | null>(userId, "/me/player");
}

export async function getAvailableDevices(userId: string) {
  const response = await spotifyFetch<SpotifyDevicesResponse>(
    userId,
    "/me/player/devices"
  );

  return response.devices;
}

export async function saveTrack(userId: string, trackId: string) {
  await spotifyFetch<null>(userId, `/me/tracks?ids=${trackId}`, {
    method: "PUT",
  });
}

export async function removeTrack(userId: string, trackId: string) {
  await spotifyFetch<null>(userId, `/me/tracks?ids=${trackId}`, {
    method: "DELETE",
  });
}

export async function createPlaylist(
  userId: string,
  name: string,
  description: string
) {
  const profile = await getSpotifyProfile(userId);

  return spotifyFetch<SpotifyPlaylist>(userId, `/users/${profile.id}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      public: false,
    }),
  });
}

export async function addTrackToPlaylist(
  userId: string,
  playlistId: string,
  trackUri: string
) {
  await spotifyFetch<null>(userId, `/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({
      uris: [trackUri],
    }),
  });
}

export async function transferPlayback(
  userId: string,
  deviceId: string,
  play = false
) {
  await spotifyFetch<null>(userId, "/me/player", {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play,
    }),
  });
}

export async function resumePlayback(userId: string, deviceId?: string) {
  const query = deviceId ? `?device_id=${deviceId}` : "";

  await spotifyFetch<null>(userId, `/me/player/play${query}`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
}

export async function playTrack(
  userId: string,
  trackUri: string,
  deviceId?: string
) {
  const query = deviceId ? `?device_id=${deviceId}` : "";

  await spotifyFetch<null>(userId, `/me/player/play${query}`, {
    method: "PUT",
    body: JSON.stringify({
      uris: [trackUri],
    }),
  });
}

export async function pausePlayback(userId: string, deviceId?: string) {
  const query = deviceId ? `?device_id=${deviceId}` : "";

  await spotifyFetch<null>(userId, `/me/player/pause${query}`, {
    method: "PUT",
  });
}

export async function skipToNextTrack(userId: string, deviceId?: string) {
  const query = deviceId ? `?device_id=${deviceId}` : "";

  await spotifyFetch<null>(userId, `/me/player/next${query}`, {
    method: "POST",
  });
}

export async function skipToPreviousTrack(userId: string, deviceId?: string) {
  const query = deviceId ? `?device_id=${deviceId}` : "";

  await spotifyFetch<null>(userId, `/me/player/previous${query}`, {
    method: "POST",
  });
}

export async function seekPlayback(
  userId: string,
  positionMs: number,
  deviceId?: string
) {
  const query = new URLSearchParams({
    position_ms: String(Math.max(0, positionMs)),
  });

  if (deviceId) {
    query.set("device_id", deviceId);
  }

  await spotifyFetch<null>(userId, `/me/player/seek?${query.toString()}`, {
    method: "PUT",
  });
}

export async function setPlaybackVolume(
  userId: string,
  volumePercent: number,
  deviceId?: string
) {
  const query = new URLSearchParams({
    volume_percent: String(Math.min(100, Math.max(0, volumePercent))),
  });

  if (deviceId) {
    query.set("device_id", deviceId);
  }

  await spotifyFetch<null>(userId, `/me/player/volume?${query.toString()}`, {
    method: "PUT",
  });
}
