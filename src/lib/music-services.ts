import { and, desc, eq, isNull, notInArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  accounts,
  musicPlaylists,
  musicServiceConnections,
  musicServiceLibraryTracks,
  musicServicePlaylistTracks,
  musicServicePlaylists,
  musicServiceTracks,
  musicTracks,
  type ServiceCapabilities,
  type ServiceProfile,
} from "@/lib/db/schema";
import {
  addTrackToPlaylist,
  createPlaylist,
  getAvailableDevices,
  getCurrentPlayback,
  getPlaylistItems,
  getPlaylists,
  getSavedTracks,
  getSpotifyProfile,
  pausePlayback,
  playContext,
  playTrack,
  removeTrack,
  removeTrackFromPlaylist,
  resumePlayback,
  saveTrack,
  seekPlayback,
  setPlaybackVolume,
  skipToNextTrack,
  skipToPreviousTrack,
  spotifyProviderId,
  transferPlayback,
} from "@/lib/spotify";
import type {
  SpotifyPagedResponse,
  SpotifyPlaylist,
  SpotifyProfile,
  SpotifyTrack,
} from "@/lib/spotify-types";

export type MusicService = "greenroom" | "orchard" | "tidepool";
export type SyncStatus = "idle" | "syncing" | "error";
export type ConnectionStatus = "connected" | "disconnected" | "coming-soon";
export type CacheSyncStatus = "synced" | "syncing" | "needs-sync";

export type MusicServiceMetadata = {
  service: MusicService;
  displayName: string;
  theme: string;
  comingSoon: boolean;
  authProviderId: string | null;
  capabilities: ServiceCapabilities;
};

export type ServiceConnectionView = MusicServiceMetadata & {
  connectionId: string | null;
  connectionStatus: ConnectionStatus;
  syncStatus: SyncStatus;
  isSyncing: boolean;
  isStale: boolean;
  profile: ServiceProfile | null;
  counts: {
    savedTracks: number;
    playlists: number;
  };
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

export type MusicTrackView = {
  id: string;
  canonicalTrackId: string;
  providerTrackId: string;
  uri: string;
  title: string;
  album: string;
  artists: { id: string; name: string; uri: string }[];
  images: { url: string; height: number | null; width: number | null }[];
  durationMs: number;
  explicit: boolean;
  previewUrl: string | null;
  externalUrl: string | null;
  savedAt: string;
  syncStatus: CacheSyncStatus;
};

export type MusicPlaylistView = {
  id: string;
  canonicalPlaylistId: string;
  providerPlaylistId: string;
  uri: string;
  name: string;
  description: string | null;
  images: { url: string; height: number | null; width: number | null }[];
  ownerDisplayName: string | null;
  revision: string | null;
  trackTotal: number;
  syncStatus: CacheSyncStatus;
};

export type MusicPlaylistTrackView = {
  id: string;
  position: number;
  addedAt: string | null;
  track: MusicTrackView | null;
  providerTrackUri: string;
};

export type MusicDashboardPayload = {
  service: ServiceConnectionView;
  savedTracks: MusicTrackView[];
  playlists: MusicPlaylistView[];
};

export type DuplicateTrackView = MusicTrackView & {
  normalizedPrimaryArtist: string;
  dedupeTitleStem: string;
  versionLabel: string | null;
  isRecommendedKeep: boolean;
};

export type DuplicateGroupView = {
  id: string;
  service: MusicService;
  title: string;
  primaryArtist: string;
  duplicateCount: number;
  recommendedKeepProviderTrackId: string;
  tracks: DuplicateTrackView[];
};

export type ServiceDuplicatesPayload = {
  service: ServiceConnectionView;
  summary: {
    groupCount: number;
    removableTrackCount: number;
    trackCount: number;
  };
  groups: DuplicateGroupView[];
};

export type DuplicateCleanupSelection = {
  keepProviderTrackId: string;
  removeProviderTrackIds: string[];
};

export type SyncHubPayload = {
  services: ServiceConnectionView[];
  mergePreview: {
    conflicts: number;
    unavailableTracks: number;
    pendingOverrides: number;
  };
};

export type AccountPayload = {
  hasPassword: boolean;
  services: ServiceConnectionView[];
};

const MUSIC_SYNC_STALE_MS = 15 * 60 * 1000;
const DUPLICATE_DURATION_TOLERANCE_MS = 15_000;
const VERSION_KEYWORDS = new Set([
  "acoustic",
  "bonus",
  "clean",
  "deluxe",
  "edit",
  "explicit",
  "live",
  "mix",
  "mono",
  "radio",
  "remaster",
  "remastered",
  "remix",
  "stereo",
  "version",
]);

type MusicServiceTrackRow = typeof musicServiceTracks.$inferSelect;
type MusicServiceLibraryTrackRow = typeof musicServiceLibraryTracks.$inferSelect;
type MusicServicePlaylistRow = typeof musicServicePlaylists.$inferSelect;
type MusicTrackRow = typeof musicTracks.$inferSelect;
type DuplicateLibraryRow = {
  library: MusicServiceLibraryTrackRow;
  track: MusicServiceTrackRow;
  canonical: MusicTrackRow;
};
type DuplicateTrackCandidate = DuplicateTrackView & {
  albumHasVersionKeyword: boolean;
  savedAtTimestamp: number;
  titleHasVersionSuffix: boolean;
  titleStemDisplay: string;
};

export const serviceRegistry: Record<MusicService, MusicServiceMetadata> = {
  greenroom: {
    service: "greenroom",
    displayName: "Spotify",
    theme: "greenroom",
    comingSoon: false,
    authProviderId: spotifyProviderId,
    capabilities: {
      playback: true,
      libraryWrite: true,
      playlistWrite: true,
    },
  },
  orchard: {
    service: "orchard",
    displayName: "Apple Music",
    theme: "orchard",
    comingSoon: true,
    authProviderId: null,
    capabilities: {
      playback: false,
      libraryWrite: false,
      playlistWrite: false,
    },
  },
  tidepool: {
    service: "tidepool",
    displayName: "Tidal",
    theme: "tidepool",
    comingSoon: true,
    authProviderId: null,
    capabilities: {
      playback: false,
      libraryWrite: false,
      playlistWrite: false,
    },
  },
};

export const musicServices = Object.keys(serviceRegistry) as MusicService[];

type ServiceAdapter = {
  service: MusicService;
  syncLibrary: (userId: string) => Promise<MusicDashboardPayload>;
  saveLibraryTrack: (
    userId: string,
    providerTrackId: string,
    shouldSave: boolean
  ) => Promise<void>;
  createPlaylist: (
    userId: string,
    name: string,
    description: string
  ) => Promise<MusicPlaylistView>;
  syncPlaylistItems: (
    userId: string,
    providerPlaylistId: string,
    offset: number,
    limit: number
  ) => Promise<SpotifyPagedResponse<MusicPlaylistTrackView>>;
  addPlaylistTrack: (
    userId: string,
    providerPlaylistId: string,
    trackUri: string
  ) => Promise<{ snapshotId?: string }>;
  removePlaylistTrack: (
    userId: string,
    providerPlaylistId: string,
    trackUri: string,
    snapshotId?: string
  ) => Promise<{ snapshotId?: string }>;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function hasVersionKeyword(value: string | null | undefined) {
  const tokens = normalize(value).split(" ").filter(Boolean);

  return tokens.some((token) => VERSION_KEYWORDS.has(token));
}

function stripTrailingVersionMarkers(value: string | null | undefined) {
  let stem = (value ?? "").trim();
  const labels: string[] = [];

  while (stem) {
    const parenthetical = stem.match(/^(.*)\s+\(([^()]*)\)\s*$/);

    if (parenthetical && hasVersionKeyword(parenthetical[2])) {
      labels.unshift(parenthetical[2].trim());
      stem = parenthetical[1].trim();
      continue;
    }

    const bracketed = stem.match(/^(.*)\s+\[([^[\]]*)\]\s*$/);

    if (bracketed && hasVersionKeyword(bracketed[2])) {
      labels.unshift(bracketed[2].trim());
      stem = bracketed[1].trim();
      continue;
    }

    const dashed = stem.match(/^(.*)\s+-\s+([^-]+)\s*$/);

    if (dashed && hasVersionKeyword(dashed[2])) {
      labels.unshift(dashed[2].trim());
      stem = dashed[1].trim();
      continue;
    }

    break;
  }

  return {
    normalizedStem: normalize(stem || value),
    stemDisplay: stem || (value ?? "").trim(),
    versionLabel: labels.length ? labels.join(" / ") : null,
  };
}

function getMedianDurationMs(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle] ?? 0;
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function asDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function itemSyncStatus(
  syncedAt: Date | null,
  syncStatus: SyncStatus
): CacheSyncStatus {
  if (syncStatus === "syncing") {
    return "syncing";
  }

  return syncedAt ? "synced" : "needs-sync";
}

function assertService(value: string | null | undefined): MusicService {
  if (value && value in serviceRegistry) {
    return value as MusicService;
  }

  throw new Error("Unsupported music service.");
}

function assertAdapter(service: MusicService) {
  const adapter = serviceAdapters[service];

  if (!adapter) {
    throw new Error(`${serviceRegistry[service].displayName} is not available yet.`);
  }

  return adapter;
}

async function getCredentialAccount(userId: string) {
  return getDb().query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
  });
}

async function getServiceAccount(userId: string, service: MusicService) {
  const authProviderId = serviceRegistry[service].authProviderId;

  if (!authProviderId) {
    return null;
  }

  return getDb().query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, authProviderId)),
  });
}

async function ensureServiceConnection(userId: string, service: MusicService) {
  const metadata = serviceRegistry[service];
  const serviceAccount = await getServiceAccount(userId, service);
  const existing = await getDb().query.musicServiceConnections.findFirst({
    where: and(
      eq(musicServiceConnections.userId, userId),
      eq(musicServiceConnections.service, service)
    ),
  });
  const now = new Date();
  const connectionStatus: ConnectionStatus = metadata.comingSoon
    ? "coming-soon"
    : serviceAccount
      ? "connected"
      : "disconnected";

  if (existing) {
    const needsUpdate =
      existing.connectionStatus !== connectionStatus ||
      existing.providerAccountId !== (serviceAccount?.accountId ?? null);

    if (needsUpdate) {
      const [updated] = await getDb()
        .update(musicServiceConnections)
        .set({
          authProviderId: metadata.authProviderId,
          providerAccountId: serviceAccount?.accountId ?? null,
          connectionStatus,
          capabilities: metadata.capabilities,
          updatedAt: now,
        })
        .where(eq(musicServiceConnections.id, existing.id))
        .returning();

      return updated;
    }

    return existing;
  }

  const [created] = await getDb()
    .insert(musicServiceConnections)
    .values({
      userId,
      service,
      authProviderId: metadata.authProviderId,
      providerAccountId: serviceAccount?.accountId ?? null,
      connectionStatus,
      capabilities: metadata.capabilities,
      profile: null,
      updatedAt: now,
    })
    .returning();

  return created;
}

async function getConnectionView(userId: string, service: MusicService) {
  const metadata = serviceRegistry[service];
  const connection = await ensureServiceConnection(userId, service);
  const [savedTracksCount, playlistsCount] = await Promise.all([
    getDb().query.musicServiceLibraryTracks.findMany({
      where: and(
        eq(musicServiceLibraryTracks.serviceConnectionId, connection.id),
        isNull(musicServiceLibraryTracks.removedAt)
      ),
    }),
    getDb().query.musicServicePlaylists.findMany({
      where: and(
        eq(musicServicePlaylists.serviceConnectionId, connection.id),
        isNull(musicServicePlaylists.removedAt)
      ),
    }),
  ]);
  const lastSuccessfulSyncAt = connection.lastSuccessfulSyncAt;
  const isStale =
    connection.connectionStatus === "connected" &&
    (!lastSuccessfulSyncAt ||
      Date.now() - lastSuccessfulSyncAt.getTime() > MUSIC_SYNC_STALE_MS);

  return {
    ...metadata,
    connectionId: connection.id,
    connectionStatus: connection.connectionStatus as ConnectionStatus,
    syncStatus: connection.syncStatus as SyncStatus,
    isSyncing: connection.syncStatus === "syncing",
    isStale,
    profile: connection.profile,
    counts: {
      savedTracks: savedTracksCount.length,
      playlists: playlistsCount.length,
    },
    lastStartedAt: toIsoDate(connection.lastStartedAt),
    lastFinishedAt: toIsoDate(connection.lastFinishedAt),
    lastSuccessfulSyncAt: toIsoDate(connection.lastSuccessfulSyncAt),
    lastError: connection.lastError,
  } satisfies ServiceConnectionView;
}

export async function getServiceConnections(userId: string) {
  return Promise.all(musicServices.map((service) => getConnectionView(userId, service)));
}

export async function getAccountPayload(userId: string): Promise<AccountPayload> {
  const [credentialAccount, services] = await Promise.all([
    getCredentialAccount(userId),
    getServiceConnections(userId),
  ]);

  return {
    hasPassword: Boolean(credentialAccount?.password),
    services,
  };
}

function spotifyProfileToServiceProfile(profile: SpotifyProfile): ServiceProfile {
  return {
    id: profile.id,
    displayName: profile.display_name,
    email: profile.email,
    imageUrl: profile.images[0]?.url ?? null,
    product: profile.product,
    country: profile.country,
    followersTotal: profile.followers.total,
  };
}

async function upsertCanonicalTrack(track: SpotifyTrack) {
  const normalizedTitle = normalize(track.name);
  const normalizedPrimaryArtist = normalize(track.artists[0]?.name);
  const normalizedAlbum = normalize(track.album.name);

  const [row] = await getDb()
    .insert(musicTracks)
    .values({
      normalizedTitle,
      normalizedPrimaryArtist,
      normalizedAlbum,
      title: track.name,
      primaryArtist: track.artists[0]?.name ?? "Unknown artist",
      album: track.album.name,
      durationMs: track.duration_ms,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        musicTracks.normalizedTitle,
        musicTracks.normalizedPrimaryArtist,
        musicTracks.normalizedAlbum,
      ],
      set: {
        title: track.name,
        primaryArtist: track.artists[0]?.name ?? "Unknown artist",
        album: track.album.name,
        durationMs: track.duration_ms,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

async function upsertServiceTrack(
  connectionId: string,
  service: MusicService,
  track: SpotifyTrack,
  syncedAt: Date
) {
  const canonical = await upsertCanonicalTrack(track);
  const [row] = await getDb()
    .insert(musicServiceTracks)
    .values({
      serviceConnectionId: connectionId,
      musicTrackId: canonical.id,
      service,
      providerTrackId: track.id,
      providerUri: track.uri,
      title: track.name,
      album: track.album.name,
      artists: track.artists,
      images: track.album.images,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      previewUrl: track.preview_url,
      externalUrl: track.external_urls?.spotify,
      availability: "available",
      rawMetadata: track as unknown as Record<string, unknown>,
      syncedAt,
      removedAt: null,
      updatedAt: syncedAt,
    })
    .onConflictDoUpdate({
      target: [
        musicServiceTracks.serviceConnectionId,
        musicServiceTracks.providerTrackId,
      ],
      set: {
        musicTrackId: canonical.id,
        providerUri: track.uri,
        title: track.name,
        album: track.album.name,
        artists: track.artists,
        images: track.album.images,
        durationMs: track.duration_ms,
        explicit: track.explicit,
        previewUrl: track.preview_url,
        externalUrl: track.external_urls?.spotify,
        availability: "available",
        rawMetadata: track as unknown as Record<string, unknown>,
        syncedAt,
        removedAt: null,
        updatedAt: syncedAt,
      },
    })
    .returning();

  return row;
}

async function upsertCanonicalPlaylist(
  userId: string,
  playlist: SpotifyPlaylist
) {
  const existing = await getDb().query.musicPlaylists.findFirst({
    where: and(
      eq(musicPlaylists.userId, userId),
      eq(musicPlaylists.name, playlist.name)
    ),
  });
  const now = new Date();

  if (existing) {
    const [updated] = await getDb()
      .update(musicPlaylists)
      .set({
        description: playlist.description,
        updatedAt: now,
      })
      .where(eq(musicPlaylists.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await getDb()
    .insert(musicPlaylists)
    .values({
      userId,
      name: playlist.name,
      description: playlist.description,
      updatedAt: now,
    })
    .returning();

  return created;
}

function serviceTrackToView(
  row: MusicServiceTrackRow,
  libraryRow: MusicServiceLibraryTrackRow,
  syncStatus: SyncStatus
): MusicTrackView {
  return {
    id: row.id,
    canonicalTrackId: row.musicTrackId,
    providerTrackId: row.providerTrackId,
    uri: row.providerUri,
    title: row.title,
    album: row.album,
    artists: row.artists,
    images: row.images,
    durationMs: row.durationMs,
    explicit: row.explicit,
    previewUrl: row.previewUrl,
    externalUrl: row.externalUrl,
    savedAt: libraryRow.savedAt.toISOString(),
    syncStatus: itemSyncStatus(libraryRow.syncedAt, syncStatus),
  };
}

function playlistToView(
  row: MusicServicePlaylistRow,
  syncStatus: SyncStatus
): MusicPlaylistView {
  return {
    id: row.id,
    canonicalPlaylistId: row.musicPlaylistId,
    providerPlaylistId: row.providerPlaylistId,
    uri: row.providerUri,
    name: row.name,
    description: row.description,
    images: row.images,
    ownerDisplayName: row.ownerDisplayName,
    revision: row.revision,
    trackTotal: row.trackTotal,
    syncStatus: itemSyncStatus(row.syncedAt, syncStatus),
  };
}

function duplicateTrackCandidateToView(
  row: DuplicateLibraryRow,
  syncStatus: SyncStatus
): DuplicateTrackCandidate {
  const trackView = serviceTrackToView(row.track, row.library, syncStatus);
  const titleAnalysis = stripTrailingVersionMarkers(row.track.title);

  return {
    ...trackView,
    normalizedPrimaryArtist: row.canonical.normalizedPrimaryArtist,
    dedupeTitleStem: titleAnalysis.normalizedStem,
    versionLabel: titleAnalysis.versionLabel,
    isRecommendedKeep: false,
    albumHasVersionKeyword: hasVersionKeyword(row.track.album),
    savedAtTimestamp: row.library.savedAt.getTime(),
    titleHasVersionSuffix: Boolean(titleAnalysis.versionLabel),
    titleStemDisplay: titleAnalysis.stemDisplay || row.track.title,
  };
}

function summarizeDuplicates(groups: DuplicateGroupView[]) {
  return {
    groupCount: groups.length,
    removableTrackCount: groups.reduce(
      (total, group) => total + Math.max(0, group.duplicateCount - 1),
      0
    ),
    trackCount: groups.reduce((total, group) => total + group.duplicateCount, 0),
  };
}

function buildDuplicateGroups(
  service: MusicService,
  syncStatus: SyncStatus,
  rows: DuplicateLibraryRow[]
) {
  const grouped = new Map<string, DuplicateTrackCandidate[]>();

  for (const row of rows) {
    const candidate = duplicateTrackCandidateToView(row, syncStatus);

    if (!candidate.normalizedPrimaryArtist || !candidate.dedupeTitleStem) {
      continue;
    }

    const key = `${candidate.normalizedPrimaryArtist}::${candidate.dedupeTitleStem}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.push(candidate);
      continue;
    }

    grouped.set(key, [candidate]);
  }

  const groups: DuplicateGroupView[] = [];

  for (const [key, tracks] of grouped) {
    if (tracks.length < 2) {
      continue;
    }

    const medianDurationMs = getMedianDurationMs(
      tracks.map((track) => track.durationMs)
    );
    const isWithinTolerance = tracks.every(
      (track) =>
        Math.abs(track.durationMs - medianDurationMs) <= DUPLICATE_DURATION_TOLERANCE_MS
    );

    if (!isWithinTolerance) {
      continue;
    }

    const rankedTracks = [...tracks].sort((left, right) => {
      if (left.titleHasVersionSuffix !== right.titleHasVersionSuffix) {
        return Number(left.titleHasVersionSuffix) - Number(right.titleHasVersionSuffix);
      }

      if (left.albumHasVersionKeyword !== right.albumHasVersionKeyword) {
        return Number(left.albumHasVersionKeyword) - Number(right.albumHasVersionKeyword);
      }

      const leftDurationDistance = Math.abs(left.durationMs - medianDurationMs);
      const rightDurationDistance = Math.abs(right.durationMs - medianDurationMs);

      if (leftDurationDistance !== rightDurationDistance) {
        return leftDurationDistance - rightDurationDistance;
      }

      if (left.savedAtTimestamp !== right.savedAtTimestamp) {
        return right.savedAtTimestamp - left.savedAtTimestamp;
      }

      return left.providerTrackId.localeCompare(right.providerTrackId);
    });
    const recommendedKeep = rankedTracks[0];

    if (!recommendedKeep) {
      continue;
    }

    groups.push({
      id: key,
      service,
      title: recommendedKeep.titleStemDisplay || recommendedKeep.title,
      primaryArtist:
        recommendedKeep.artists[0]?.name ||
        rowTrackPrimaryArtist(recommendedKeep.artists) ||
        "Unknown artist",
      duplicateCount: rankedTracks.length,
      recommendedKeepProviderTrackId: recommendedKeep.providerTrackId,
      tracks: rankedTracks.map(
        ({
          albumHasVersionKeyword: _albumHasVersionKeyword,
          savedAtTimestamp: _savedAtTimestamp,
          titleHasVersionSuffix: _titleHasVersionSuffix,
          titleStemDisplay: _titleStemDisplay,
          ...track
        }) => ({
          ...track,
          isRecommendedKeep:
            track.providerTrackId === recommendedKeep.providerTrackId,
        })
      ),
    });
  }

  return groups.sort((left, right) => {
    if (right.duplicateCount !== left.duplicateCount) {
      return right.duplicateCount - left.duplicateCount;
    }

    return left.title.localeCompare(right.title);
  });
}

function rowTrackPrimaryArtist(artists: { name: string }[]) {
  return artists[0]?.name ?? "";
}

async function getDashboardForConnection(
  userId: string,
  service: MusicService
): Promise<MusicDashboardPayload> {
  const serviceView = await getConnectionView(userId, service);

  if (!serviceView.connectionId) {
    return {
      service: serviceView,
      savedTracks: [],
      playlists: [],
    };
  }

  const [libraryRows, playlistRows] = await Promise.all([
    getDb()
      .select({
        library: musicServiceLibraryTracks,
        track: musicServiceTracks,
      })
      .from(musicServiceLibraryTracks)
      .innerJoin(
        musicServiceTracks,
        eq(musicServiceLibraryTracks.musicServiceTrackId, musicServiceTracks.id)
      )
      .where(
        and(
          eq(musicServiceLibraryTracks.serviceConnectionId, serviceView.connectionId),
          isNull(musicServiceLibraryTracks.removedAt),
          isNull(musicServiceTracks.removedAt)
        )
      )
      .orderBy(desc(musicServiceLibraryTracks.savedAt)),
    getDb().query.musicServicePlaylists.findMany({
      where: and(
        eq(musicServicePlaylists.serviceConnectionId, serviceView.connectionId),
        isNull(musicServicePlaylists.removedAt)
      ),
      orderBy: [musicServicePlaylists.name],
    }),
  ]);

  return {
    service: serviceView,
    savedTracks: libraryRows.map(({ library, track }) =>
      serviceTrackToView(track, library, serviceView.syncStatus)
    ),
    playlists: playlistRows.map((playlist) =>
      playlistToView(playlist, serviceView.syncStatus)
    ),
  };
}

export async function getMusicDashboard(
  userId: string,
  requestedService: string | null | undefined
) {
  const service = assertService(requestedService ?? "greenroom");

  return getDashboardForConnection(userId, service);
}

export async function getSyncHub(userId: string): Promise<SyncHubPayload> {
  const services = await getServiceConnections(userId);

  return {
    services,
    mergePreview: {
      conflicts: 0,
      unavailableTracks: 0,
      pendingOverrides: 0,
    },
  };
}

async function getDuplicatesForConnection(
  userId: string,
  service: MusicService
): Promise<ServiceDuplicatesPayload> {
  const serviceView = await getConnectionView(userId, service);

  if (
    !serviceView.connectionId ||
    serviceView.connectionStatus !== "connected"
  ) {
    return {
      service: serviceView,
      summary: {
        groupCount: 0,
        removableTrackCount: 0,
        trackCount: 0,
      },
      groups: [],
    };
  }

  const rows = await getDb()
    .select({
      library: musicServiceLibraryTracks,
      track: musicServiceTracks,
      canonical: musicTracks,
    })
    .from(musicServiceLibraryTracks)
    .innerJoin(
      musicServiceTracks,
      eq(musicServiceLibraryTracks.musicServiceTrackId, musicServiceTracks.id)
    )
    .innerJoin(musicTracks, eq(musicServiceTracks.musicTrackId, musicTracks.id))
    .where(
      and(
        eq(musicServiceLibraryTracks.serviceConnectionId, serviceView.connectionId),
        isNull(musicServiceLibraryTracks.removedAt),
        isNull(musicServiceTracks.removedAt)
      )
    )
    .orderBy(desc(musicServiceLibraryTracks.savedAt));
  const groups = buildDuplicateGroups(service, serviceView.syncStatus, rows);

  return {
    service: serviceView,
    summary: summarizeDuplicates(groups),
    groups,
  };
}

export async function getServiceDuplicates(
  userId: string,
  serviceValue: string
): Promise<ServiceDuplicatesPayload> {
  const service = assertService(serviceValue);

  return getDuplicatesForConnection(userId, service);
}

export async function cleanupServiceDuplicates(
  userId: string,
  serviceValue: string,
  selections: DuplicateCleanupSelection[]
): Promise<ServiceDuplicatesPayload> {
  const service = assertService(serviceValue);

  for (const selection of selections) {
    const removeProviderTrackIds = Array.from(
      new Set(
        selection.removeProviderTrackIds.filter(
          (providerTrackId) =>
            providerTrackId && providerTrackId !== selection.keepProviderTrackId
        )
      )
    );

    for (const providerTrackId of removeProviderTrackIds) {
      await saveServiceLibraryTrack(userId, service, providerTrackId, false);
    }
  }

  return getDuplicatesForConnection(userId, service);
}

async function syncGreenroomLibrary(userId: string) {
  const service: MusicService = "greenroom";
  const connection = await ensureServiceConnection(userId, service);

  if (connection.connectionStatus !== "connected") {
    throw new Error("Connect Spotify before syncing.");
  }

  const startedAt = new Date();

  await getDb()
    .update(musicServiceConnections)
    .set({
      syncStatus: "syncing",
      lastStartedAt: startedAt,
      lastError: null,
      updatedAt: startedAt,
    })
    .where(eq(musicServiceConnections.id, connection.id));

  try {
    const [profile, savedTracks, playlists] = await Promise.all([
      getSpotifyProfile(userId),
      getSavedTracks(userId),
      getPlaylists(userId),
    ]);
    const syncedAt = new Date();
    const serviceTrackIds: string[] = [];
    const servicePlaylistIds: string[] = [];

    for (const item of savedTracks) {
      const serviceTrack = await upsertServiceTrack(
        connection.id,
        service,
        item.track,
        syncedAt
      );
      serviceTrackIds.push(serviceTrack.id);

      await getDb()
        .insert(musicServiceLibraryTracks)
        .values({
          serviceConnectionId: connection.id,
          musicServiceTrackId: serviceTrack.id,
          savedAt: new Date(item.added_at),
          syncedAt,
          removedAt: null,
          updatedAt: syncedAt,
        })
        .onConflictDoUpdate({
          target: [
            musicServiceLibraryTracks.serviceConnectionId,
            musicServiceLibraryTracks.musicServiceTrackId,
          ],
          set: {
            savedAt: new Date(item.added_at),
            syncedAt,
            removedAt: null,
            updatedAt: syncedAt,
          },
        });
    }

    for (const playlist of playlists) {
      const canonical = await upsertCanonicalPlaylist(userId, playlist);
      const [servicePlaylist] = await getDb()
        .insert(musicServicePlaylists)
        .values({
          serviceConnectionId: connection.id,
          musicPlaylistId: canonical.id,
          service,
          providerPlaylistId: playlist.id,
          providerUri: playlist.uri,
          name: playlist.name,
          description: playlist.description,
          images: playlist.images,
          ownerDisplayName: playlist.owner.display_name,
          revision: playlist.snapshot_id,
          trackTotal: playlist.tracks.total,
          rawMetadata: playlist as unknown as Record<string, unknown>,
          syncedAt,
          removedAt: null,
          updatedAt: syncedAt,
        })
        .onConflictDoUpdate({
          target: [
            musicServicePlaylists.serviceConnectionId,
            musicServicePlaylists.providerPlaylistId,
          ],
          set: {
            musicPlaylistId: canonical.id,
            providerUri: playlist.uri,
            name: playlist.name,
            description: playlist.description,
            images: playlist.images,
            ownerDisplayName: playlist.owner.display_name,
            revision: playlist.snapshot_id,
            trackTotal: playlist.tracks.total,
            rawMetadata: playlist as unknown as Record<string, unknown>,
            syncedAt,
            removedAt: null,
            updatedAt: syncedAt,
          },
        })
        .returning();

      servicePlaylistIds.push(servicePlaylist.id);
    }

    await markMissingServiceRowsRemoved(connection.id, serviceTrackIds, servicePlaylistIds, syncedAt);

    await getDb()
      .update(musicServiceConnections)
      .set({
        syncStatus: "idle",
        connectionStatus: "connected",
        profile: spotifyProfileToServiceProfile(profile),
        lastFinishedAt: syncedAt,
        lastSuccessfulSyncAt: syncedAt,
        lastError: null,
        updatedAt: syncedAt,
      })
      .where(eq(musicServiceConnections.id, connection.id));

    return getDashboardForConnection(userId, service);
  } catch (error) {
    const finishedAt = new Date();

    await getDb()
      .update(musicServiceConnections)
      .set({
        syncStatus: "error",
        lastFinishedAt: finishedAt,
        lastError: error instanceof Error ? error.message : "Sync failed.",
        updatedAt: finishedAt,
      })
      .where(eq(musicServiceConnections.id, connection.id));

    throw error;
  }
}

async function markMissingServiceRowsRemoved(
  connectionId: string,
  serviceTrackIds: string[],
  servicePlaylistIds: string[],
  removedAt: Date
) {
  await getDb()
    .update(musicServiceLibraryTracks)
    .set({
      removedAt,
      updatedAt: removedAt,
    })
    .where(
      serviceTrackIds.length
        ? and(
            eq(musicServiceLibraryTracks.serviceConnectionId, connectionId),
            isNull(musicServiceLibraryTracks.removedAt),
            notInArray(musicServiceLibraryTracks.musicServiceTrackId, serviceTrackIds)
          )
        : and(
            eq(musicServiceLibraryTracks.serviceConnectionId, connectionId),
            isNull(musicServiceLibraryTracks.removedAt)
          )
    );

  await getDb()
    .update(musicServicePlaylists)
    .set({
      removedAt,
      updatedAt: removedAt,
    })
    .where(
      servicePlaylistIds.length
        ? and(
            eq(musicServicePlaylists.serviceConnectionId, connectionId),
            isNull(musicServicePlaylists.removedAt),
            notInArray(musicServicePlaylists.id, servicePlaylistIds)
          )
        : and(
            eq(musicServicePlaylists.serviceConnectionId, connectionId),
            isNull(musicServicePlaylists.removedAt)
          )
    );
}

async function saveGreenroomLibraryTrack(
  userId: string,
  providerTrackId: string,
  shouldSave: boolean
) {
  if (shouldSave) {
    await saveTrack(userId, providerTrackId);
    return;
  }

  await removeTrack(userId, providerTrackId);

  const connection = await ensureServiceConnection(userId, "greenroom");
  const serviceTrack = await getDb().query.musicServiceTracks.findFirst({
    where: and(
      eq(musicServiceTracks.serviceConnectionId, connection.id),
      eq(musicServiceTracks.providerTrackId, providerTrackId)
    ),
  });

  if (!serviceTrack) {
    return;
  }

  await getDb()
    .update(musicServiceLibraryTracks)
    .set({
      removedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(musicServiceLibraryTracks.serviceConnectionId, connection.id),
        eq(musicServiceLibraryTracks.musicServiceTrackId, serviceTrack.id)
      )
    );
}

async function createGreenroomPlaylist(
  userId: string,
  name: string,
  description: string
) {
  const connection = await ensureServiceConnection(userId, "greenroom");
  const playlist = await createPlaylist(userId, name, description);
  const syncedAt = new Date();
  const canonical = await upsertCanonicalPlaylist(userId, playlist);
  const [servicePlaylist] = await getDb()
    .insert(musicServicePlaylists)
    .values({
      serviceConnectionId: connection.id,
      musicPlaylistId: canonical.id,
      service: "greenroom",
      providerPlaylistId: playlist.id,
      providerUri: playlist.uri,
      name: playlist.name,
      description: playlist.description,
      images: playlist.images,
      ownerDisplayName: playlist.owner.display_name,
      revision: playlist.snapshot_id,
      trackTotal: playlist.tracks.total,
      rawMetadata: playlist as unknown as Record<string, unknown>,
      syncedAt,
      updatedAt: syncedAt,
    })
    .onConflictDoUpdate({
      target: [
        musicServicePlaylists.serviceConnectionId,
        musicServicePlaylists.providerPlaylistId,
      ],
      set: {
        name: playlist.name,
        description: playlist.description,
        images: playlist.images,
        revision: playlist.snapshot_id,
        trackTotal: playlist.tracks.total,
        syncedAt,
        removedAt: null,
        updatedAt: syncedAt,
      },
    })
    .returning();

  return playlistToView(servicePlaylist, "idle");
}

async function getServicePlaylist(
  userId: string,
  service: MusicService,
  providerPlaylistId: string
) {
  const connection = await ensureServiceConnection(userId, service);

  return getDb().query.musicServicePlaylists.findFirst({
    where: and(
      eq(musicServicePlaylists.serviceConnectionId, connection.id),
      eq(musicServicePlaylists.providerPlaylistId, providerPlaylistId)
    ),
  });
}

function spotifyTrackToView(
  track: SpotifyTrack,
  addedAt: string | null,
  position: number
): MusicPlaylistTrackView {
  return {
    id: `${track.uri}-${position}`,
    position,
    addedAt,
    providerTrackUri: track.uri,
    track: {
      id: track.id,
      canonicalTrackId: track.id,
      providerTrackId: track.id,
      uri: track.uri,
      title: track.name,
      album: track.album.name,
      artists: track.artists,
      images: track.album.images,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      previewUrl: track.preview_url,
      externalUrl: track.external_urls?.spotify ?? null,
      savedAt: addedAt ?? new Date().toISOString(),
      syncStatus: "synced",
    },
  };
}

async function syncGreenroomPlaylistItems(
  userId: string,
  providerPlaylistId: string,
  offset: number,
  limit: number
) {
  const connection = await ensureServiceConnection(userId, "greenroom");
  const servicePlaylist = await getServicePlaylist(
    userId,
    "greenroom",
    providerPlaylistId
  );

  if (!servicePlaylist) {
    throw new Error("Playlist is not cached yet. Sync Spotify first.");
  }

  const page = await getPlaylistItems(userId, providerPlaylistId, offset, limit);
  const syncedAt = new Date();
  const views: MusicPlaylistTrackView[] = [];

  for (const [index, item] of page.items.entries()) {
    if (!item.track) {
      continue;
    }

    const position = offset + index;
    const serviceTrack = await upsertServiceTrack(
      connection.id,
      "greenroom",
      item.track,
      syncedAt
    );

    await getDb()
      .insert(musicServicePlaylistTracks)
      .values({
        serviceConnectionId: connection.id,
        musicServicePlaylistId: servicePlaylist.id,
        musicServiceTrackId: serviceTrack.id,
        providerTrackId: item.track.id,
        providerTrackUri: item.track.uri,
        track: item.track as unknown as Record<string, unknown>,
        position,
        addedAt: asDate(item.added_at),
        syncedAt,
        removedAt: null,
        updatedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: [
          musicServicePlaylistTracks.musicServicePlaylistId,
          musicServicePlaylistTracks.providerTrackUri,
          musicServicePlaylistTracks.position,
        ],
        set: {
          musicServiceTrackId: serviceTrack.id,
          providerTrackId: item.track.id,
          track: item.track as unknown as Record<string, unknown>,
          addedAt: asDate(item.added_at),
          syncedAt,
          removedAt: null,
          updatedAt: syncedAt,
        },
      });

    views.push(spotifyTrackToView(item.track, item.added_at, position));
  }

  await getDb()
    .update(musicServicePlaylists)
    .set({
      trackTotal: page.total,
      syncedAt,
      updatedAt: syncedAt,
    })
    .where(eq(musicServicePlaylists.id, servicePlaylist.id));

  return {
    ...page,
    items: views,
  };
}

async function addGreenroomPlaylistTrack(
  userId: string,
  providerPlaylistId: string,
  trackUri: string
) {
  const payload = await addTrackToPlaylist(userId, providerPlaylistId, trackUri);
  await syncGreenroomPlaylistItems(userId, providerPlaylistId, 0, 50);

  return { snapshotId: payload.snapshot_id };
}

async function removeGreenroomPlaylistTrack(
  userId: string,
  providerPlaylistId: string,
  trackUri: string,
  snapshotId?: string
) {
  const payload = await removeTrackFromPlaylist(
    userId,
    providerPlaylistId,
    trackUri,
    snapshotId
  );
  await syncGreenroomPlaylistItems(userId, providerPlaylistId, 0, 50);

  return { snapshotId: payload.snapshot_id };
}

export async function syncService(userId: string, serviceValue: string) {
  const service = assertService(serviceValue);
  const adapter = assertAdapter(service);

  return adapter.syncLibrary(userId);
}

export async function saveServiceLibraryTrack(
  userId: string,
  serviceValue: string,
  providerTrackId: string,
  shouldSave: boolean
) {
  const adapter = assertAdapter(assertService(serviceValue));

  return adapter.saveLibraryTrack(userId, providerTrackId, shouldSave);
}

export async function createServicePlaylist(
  userId: string,
  serviceValue: string,
  name: string,
  description: string
) {
  const adapter = assertAdapter(assertService(serviceValue));

  return adapter.createPlaylist(userId, name, description);
}

export async function getServicePlaylistTracks(
  userId: string,
  serviceValue: string,
  providerPlaylistId: string,
  offset = 0,
  limit = 50
) {
  const adapter = assertAdapter(assertService(serviceValue));

  return adapter.syncPlaylistItems(
    userId,
    providerPlaylistId,
    Math.max(0, offset),
    Math.min(50, Math.max(1, limit))
  );
}

export async function addServicePlaylistTrack(
  userId: string,
  serviceValue: string,
  providerPlaylistId: string,
  trackUri: string
) {
  const adapter = assertAdapter(assertService(serviceValue));

  return adapter.addPlaylistTrack(userId, providerPlaylistId, trackUri);
}

export async function removeServicePlaylistTrack(
  userId: string,
  serviceValue: string,
  providerPlaylistId: string,
  trackUri: string,
  snapshotId?: string
) {
  const adapter = assertAdapter(assertService(serviceValue));

  return adapter.removePlaylistTrack(userId, providerPlaylistId, trackUri, snapshotId);
}

export async function getServicePlayer(userId: string, serviceValue: string) {
  const service = assertService(serviceValue);
  const connection = await ensureServiceConnection(userId, service);

  if (!serviceRegistry[service].capabilities.playback) {
    throw new Error(`${serviceRegistry[service].displayName} playback is not supported yet.`);
  }

  if (connection.connectionStatus !== "connected") {
    return {
      playback: null,
      devices: [],
    };
  }

  const [playback, devices] = await Promise.all([
    getCurrentPlayback(userId),
    getAvailableDevices(userId),
  ]);

  return { playback, devices };
}

export async function runServicePlayerAction(
  userId: string,
  serviceValue: string,
  body: {
    action?: string;
    contextUri?: string;
    deviceId?: string;
    trackUri?: string;
    positionMs?: number;
    volumePercent?: number;
    play?: boolean;
  }
) {
  const service = assertService(serviceValue);
  const connection = await ensureServiceConnection(userId, service);

  if (!serviceRegistry[service].capabilities.playback) {
    throw new Error(`${serviceRegistry[service].displayName} playback is not supported yet.`);
  }

  if (connection.connectionStatus !== "connected") {
    throw new Error(`Connect ${serviceRegistry[service].displayName} before using playback.`);
  }

  switch (body.action) {
    case "transfer":
      if (!body.deviceId) throw new Error("deviceId is required.");
      await transferPlayback(userId, body.deviceId, body.play);
      break;
    case "play-track":
      if (!body.trackUri) throw new Error("trackUri is required.");
      await playTrack(userId, body.trackUri, body.deviceId);
      break;
    case "play-context":
      if (!body.contextUri) throw new Error("contextUri is required.");
      await playContext(userId, body.contextUri, body.deviceId);
      break;
    case "resume":
      await resumePlayback(userId, body.deviceId);
      break;
    case "pause":
      await pausePlayback(userId, body.deviceId);
      break;
    case "next":
      await skipToNextTrack(userId, body.deviceId);
      break;
    case "previous":
      await skipToPreviousTrack(userId, body.deviceId);
      break;
    case "seek":
      if (typeof body.positionMs !== "number") throw new Error("positionMs is required.");
      await seekPlayback(userId, body.positionMs, body.deviceId);
      break;
    case "volume":
      if (typeof body.volumePercent !== "number") {
        throw new Error("volumePercent is required.");
      }
      await setPlaybackVolume(userId, body.volumePercent, body.deviceId);
      break;
    default:
      throw new Error("Unsupported player action.");
  }
}

const serviceAdapters: Partial<Record<MusicService, ServiceAdapter>> = {
  greenroom: {
    service: "greenroom",
    syncLibrary: syncGreenroomLibrary,
    saveLibraryTrack: saveGreenroomLibraryTrack,
    createPlaylist: createGreenroomPlaylist,
    syncPlaylistItems: syncGreenroomPlaylistItems,
    addPlaylistTrack: addGreenroomPlaylistTrack,
    removePlaylistTrack: removeGreenroomPlaylistTrack,
  },
};
