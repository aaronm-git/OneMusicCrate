import type { MusicService } from "@/lib/music-services";

export const musicKeys = {
  account: () => ["music", "account"] as const,
  dashboard: (service: MusicService) =>
    ["music", "dashboard", service] as const,
  duplicates: (service: MusicService) =>
    ["music", "duplicates", service] as const,
  player: (service: MusicService) => ["music", "player", service] as const,
  playlistTracks: (service: MusicService, playlistId: string) =>
    ["music", "playlist-tracks", service, playlistId] as const,
  services: () => ["music", "services"] as const,
  syncHub: () => ["music", "sync-hub"] as const,
};
