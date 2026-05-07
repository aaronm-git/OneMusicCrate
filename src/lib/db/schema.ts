import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestampColumn = (name: string) =>
  timestamp(name, {
    mode: "date",
    withTimezone: true,
  });

export const users = pgTable(
  "user",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("user_email_idx").on(table.email)]
);

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    expiresAt: timestampColumn("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestampColumn("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestampColumn("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("account_provider_account_unique").on(
      table.providerId,
      table.accountId
    ),
    index("account_user_id_idx").on(table.userId),
  ]
);

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestampColumn("expiresAt").notNull(),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export type ServiceCapabilities = {
  playback: boolean;
  libraryWrite: boolean;
  playlistWrite: boolean;
};

export type ServiceProfile = {
  id: string;
  displayName: string | null;
  email: string | null;
  imageUrl: string | null;
  product: string | null;
  country: string | null;
  followersTotal: number;
};

export const musicServiceConnections = pgTable(
  "music_service_connection",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    authProviderId: text("authProviderId"),
    providerAccountId: text("providerAccountId"),
    connectionStatus: text("connectionStatus").notNull().default("disconnected"),
    syncStatus: text("syncStatus").notNull().default("idle"),
    capabilities: jsonb("capabilities").$type<ServiceCapabilities>().notNull(),
    profile: jsonb("profile").$type<ServiceProfile | null>(),
    lastStartedAt: timestampColumn("lastStartedAt"),
    lastFinishedAt: timestampColumn("lastFinishedAt"),
    lastSuccessfulSyncAt: timestampColumn("lastSuccessfulSyncAt"),
    lastError: text("lastError"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("music_service_connection_user_service_unique").on(
      table.userId,
      table.service
    ),
    index("music_service_connection_user_id_idx").on(table.userId),
  ]
);

export const musicTracks = pgTable(
  "music_track",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    normalizedTitle: text("normalizedTitle").notNull(),
    normalizedPrimaryArtist: text("normalizedPrimaryArtist").notNull(),
    normalizedAlbum: text("normalizedAlbum"),
    title: text("title").notNull(),
    primaryArtist: text("primaryArtist").notNull(),
    album: text("album"),
    durationMs: integer("durationMs"),
    isrc: text("isrc"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("music_track_match_unique").on(
      table.normalizedTitle,
      table.normalizedPrimaryArtist,
      table.normalizedAlbum
    ),
    index("music_track_title_idx").on(table.normalizedTitle),
  ]
);

export const musicPlaylists = pgTable(
  "music_playlist",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("music_playlist_user_id_idx").on(table.userId)]
);

export const musicServiceTracks = pgTable(
  "music_service_track",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    serviceConnectionId: text("serviceConnectionId")
      .notNull()
      .references(() => musicServiceConnections.id, { onDelete: "cascade" }),
    musicTrackId: text("musicTrackId")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    providerTrackId: text("providerTrackId").notNull(),
    providerUri: text("providerUri").notNull(),
    title: text("title").notNull(),
    album: text("album").notNull(),
    artists: jsonb("artists").$type<
      { id: string; name: string; uri: string }[]
    >().notNull().default([]),
    images: jsonb("images").$type<
      { url: string; height: number | null; width: number | null }[]
    >().notNull().default([]),
    durationMs: integer("durationMs").notNull(),
    explicit: boolean("explicit").notNull().default(false),
    previewUrl: text("previewUrl"),
    externalUrl: text("externalUrl"),
    availability: text("availability").notNull().default("available"),
    rawMetadata: jsonb("rawMetadata").$type<Record<string, unknown>>().notNull(),
    syncedAt: timestampColumn("syncedAt"),
    removedAt: timestampColumn("removedAt"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("music_service_track_connection_provider_unique").on(
      table.serviceConnectionId,
      table.providerTrackId
    ),
    index("music_service_track_connection_idx").on(table.serviceConnectionId),
    index("music_service_track_track_idx").on(table.musicTrackId),
  ]
);

export const musicServiceLibraryTracks = pgTable(
  "music_service_library_track",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    serviceConnectionId: text("serviceConnectionId")
      .notNull()
      .references(() => musicServiceConnections.id, { onDelete: "cascade" }),
    musicServiceTrackId: text("musicServiceTrackId")
      .notNull()
      .references(() => musicServiceTracks.id, { onDelete: "cascade" }),
    savedAt: timestampColumn("savedAt").notNull(),
    syncedAt: timestampColumn("syncedAt"),
    removedAt: timestampColumn("removedAt"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("music_service_library_track_unique").on(
      table.serviceConnectionId,
      table.musicServiceTrackId
    ),
    index("music_service_library_connection_idx").on(table.serviceConnectionId),
    index("music_service_library_removed_idx").on(table.removedAt),
  ]
);

export const musicServicePlaylists = pgTable(
  "music_service_playlist",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    serviceConnectionId: text("serviceConnectionId")
      .notNull()
      .references(() => musicServiceConnections.id, { onDelete: "cascade" }),
    musicPlaylistId: text("musicPlaylistId")
      .notNull()
      .references(() => musicPlaylists.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    providerPlaylistId: text("providerPlaylistId").notNull(),
    providerUri: text("providerUri").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    images: jsonb("images").$type<
      { url: string; height: number | null; width: number | null }[]
    >().notNull().default([]),
    ownerDisplayName: text("ownerDisplayName"),
    revision: text("revision"),
    trackTotal: integer("trackTotal").notNull().default(0),
    rawMetadata: jsonb("rawMetadata").$type<Record<string, unknown>>().notNull(),
    syncedAt: timestampColumn("syncedAt"),
    removedAt: timestampColumn("removedAt"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("music_service_playlist_connection_provider_unique").on(
      table.serviceConnectionId,
      table.providerPlaylistId
    ),
    index("music_service_playlist_connection_idx").on(table.serviceConnectionId),
    index("music_service_playlist_playlist_idx").on(table.musicPlaylistId),
  ]
);

export const musicServicePlaylistTracks = pgTable(
  "music_service_playlist_track",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    serviceConnectionId: text("serviceConnectionId")
      .notNull()
      .references(() => musicServiceConnections.id, { onDelete: "cascade" }),
    musicServicePlaylistId: text("musicServicePlaylistId")
      .notNull()
      .references(() => musicServicePlaylists.id, { onDelete: "cascade" }),
    musicServiceTrackId: text("musicServiceTrackId").references(
      () => musicServiceTracks.id,
      { onDelete: "set null" }
    ),
    providerTrackId: text("providerTrackId"),
    providerTrackUri: text("providerTrackUri").notNull(),
    track: jsonb("track").$type<Record<string, unknown> | null>(),
    position: integer("position").notNull().default(0),
    addedAt: timestampColumn("addedAt"),
    syncedAt: timestampColumn("syncedAt"),
    removedAt: timestampColumn("removedAt"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("music_service_playlist_track_unique").on(
      table.musicServicePlaylistId,
      table.providerTrackUri,
      table.position
    ),
    index("music_service_playlist_track_playlist_idx").on(
      table.musicServicePlaylistId
    ),
    index("music_service_playlist_track_connection_idx").on(
      table.serviceConnectionId
    ),
  ]
);

export const authSchema = {
  users,
  sessions,
  accounts,
  verifications,
  musicServiceConnections,
  musicTracks,
  musicPlaylists,
  musicServiceTracks,
  musicServiceLibraryTracks,
  musicServicePlaylists,
  musicServicePlaylistTracks,
};

export const betterAuthSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
};
