DROP TABLE IF EXISTS "music_service_playlist_track" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "music_service_library_track" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "music_service_playlist" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "music_service_track" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "music_playlist" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "music_track" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "music_service_connection" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "playlist_track" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "saved_track" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "playlist" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "music_provider_profile" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "music_provider_sync" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "verification" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "session" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "account" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user" CASCADE;--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_playlist" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_service_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"service" text NOT NULL,
	"authProviderId" text,
	"providerAccountId" text,
	"connectionStatus" text DEFAULT 'disconnected' NOT NULL,
	"syncStatus" text DEFAULT 'idle' NOT NULL,
	"capabilities" jsonb NOT NULL,
	"profile" jsonb,
	"lastStartedAt" timestamp with time zone,
	"lastFinishedAt" timestamp with time zone,
	"lastSuccessfulSyncAt" timestamp with time zone,
	"lastError" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_service_library_track" (
	"id" text PRIMARY KEY NOT NULL,
	"serviceConnectionId" text NOT NULL,
	"musicServiceTrackId" text NOT NULL,
	"savedAt" timestamp with time zone NOT NULL,
	"syncedAt" timestamp with time zone,
	"removedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_service_playlist_track" (
	"id" text PRIMARY KEY NOT NULL,
	"serviceConnectionId" text NOT NULL,
	"musicServicePlaylistId" text NOT NULL,
	"musicServiceTrackId" text,
	"providerTrackId" text,
	"providerTrackUri" text NOT NULL,
	"track" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"addedAt" timestamp with time zone,
	"syncedAt" timestamp with time zone,
	"removedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_service_playlist" (
	"id" text PRIMARY KEY NOT NULL,
	"serviceConnectionId" text NOT NULL,
	"musicPlaylistId" text NOT NULL,
	"service" text NOT NULL,
	"providerPlaylistId" text NOT NULL,
	"providerUri" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ownerDisplayName" text,
	"revision" text,
	"trackTotal" integer DEFAULT 0 NOT NULL,
	"rawMetadata" jsonb NOT NULL,
	"syncedAt" timestamp with time zone,
	"removedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_service_track" (
	"id" text PRIMARY KEY NOT NULL,
	"serviceConnectionId" text NOT NULL,
	"musicTrackId" text NOT NULL,
	"service" text NOT NULL,
	"providerTrackId" text NOT NULL,
	"providerUri" text NOT NULL,
	"title" text NOT NULL,
	"album" text NOT NULL,
	"artists" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"durationMs" integer NOT NULL,
	"explicit" boolean DEFAULT false NOT NULL,
	"previewUrl" text,
	"externalUrl" text,
	"availability" text DEFAULT 'available' NOT NULL,
	"rawMetadata" jsonb NOT NULL,
	"syncedAt" timestamp with time zone,
	"removedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_track" (
	"id" text PRIMARY KEY NOT NULL,
	"normalizedTitle" text NOT NULL,
	"normalizedPrimaryArtist" text NOT NULL,
	"normalizedAlbum" text,
	"title" text NOT NULL,
	"primaryArtist" text NOT NULL,
	"album" text,
	"durationMs" integer,
	"isrc" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_playlist" ADD CONSTRAINT "music_playlist_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_connection" ADD CONSTRAINT "music_service_connection_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_library_track" ADD CONSTRAINT "music_service_library_track_serviceConnectionId_music_service_connection_id_fk" FOREIGN KEY ("serviceConnectionId") REFERENCES "public"."music_service_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_library_track" ADD CONSTRAINT "music_service_library_track_musicServiceTrackId_music_service_track_id_fk" FOREIGN KEY ("musicServiceTrackId") REFERENCES "public"."music_service_track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_playlist_track" ADD CONSTRAINT "music_service_playlist_track_serviceConnectionId_music_service_connection_id_fk" FOREIGN KEY ("serviceConnectionId") REFERENCES "public"."music_service_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_playlist_track" ADD CONSTRAINT "music_service_playlist_track_musicServicePlaylistId_music_service_playlist_id_fk" FOREIGN KEY ("musicServicePlaylistId") REFERENCES "public"."music_service_playlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_playlist_track" ADD CONSTRAINT "music_service_playlist_track_musicServiceTrackId_music_service_track_id_fk" FOREIGN KEY ("musicServiceTrackId") REFERENCES "public"."music_service_track"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_playlist" ADD CONSTRAINT "music_service_playlist_serviceConnectionId_music_service_connection_id_fk" FOREIGN KEY ("serviceConnectionId") REFERENCES "public"."music_service_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_playlist" ADD CONSTRAINT "music_service_playlist_musicPlaylistId_music_playlist_id_fk" FOREIGN KEY ("musicPlaylistId") REFERENCES "public"."music_playlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_track" ADD CONSTRAINT "music_service_track_serviceConnectionId_music_service_connection_id_fk" FOREIGN KEY ("serviceConnectionId") REFERENCES "public"."music_service_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_service_track" ADD CONSTRAINT "music_service_track_musicTrackId_music_track_id_fk" FOREIGN KEY ("musicTrackId") REFERENCES "public"."music_track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("providerId","accountId");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "music_playlist_user_id_idx" ON "music_playlist" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "music_service_connection_user_service_unique" ON "music_service_connection" USING btree ("userId","service");--> statement-breakpoint
CREATE INDEX "music_service_connection_user_id_idx" ON "music_service_connection" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "music_service_library_track_unique" ON "music_service_library_track" USING btree ("serviceConnectionId","musicServiceTrackId");--> statement-breakpoint
CREATE INDEX "music_service_library_connection_idx" ON "music_service_library_track" USING btree ("serviceConnectionId");--> statement-breakpoint
CREATE INDEX "music_service_library_removed_idx" ON "music_service_library_track" USING btree ("removedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "music_service_playlist_track_unique" ON "music_service_playlist_track" USING btree ("musicServicePlaylistId","providerTrackUri","position");--> statement-breakpoint
CREATE INDEX "music_service_playlist_track_playlist_idx" ON "music_service_playlist_track" USING btree ("musicServicePlaylistId");--> statement-breakpoint
CREATE INDEX "music_service_playlist_track_connection_idx" ON "music_service_playlist_track" USING btree ("serviceConnectionId");--> statement-breakpoint
CREATE UNIQUE INDEX "music_service_playlist_connection_provider_unique" ON "music_service_playlist" USING btree ("serviceConnectionId","providerPlaylistId");--> statement-breakpoint
CREATE INDEX "music_service_playlist_connection_idx" ON "music_service_playlist" USING btree ("serviceConnectionId");--> statement-breakpoint
CREATE INDEX "music_service_playlist_playlist_idx" ON "music_service_playlist" USING btree ("musicPlaylistId");--> statement-breakpoint
CREATE UNIQUE INDEX "music_service_track_connection_provider_unique" ON "music_service_track" USING btree ("serviceConnectionId","providerTrackId");--> statement-breakpoint
CREATE INDEX "music_service_track_connection_idx" ON "music_service_track" USING btree ("serviceConnectionId");--> statement-breakpoint
CREATE INDEX "music_service_track_track_idx" ON "music_service_track" USING btree ("musicTrackId");--> statement-breakpoint
CREATE UNIQUE INDEX "music_track_match_unique" ON "music_track" USING btree ("normalizedTitle","normalizedPrimaryArtist","normalizedAlbum");--> statement-breakpoint
CREATE INDEX "music_track_title_idx" ON "music_track" USING btree ("normalizedTitle");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
