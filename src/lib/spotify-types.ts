export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  uri: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  type?: string;
  duration_ms: number;
  explicit: boolean;
  preview_url: string | null;
  album: SpotifyAlbum;
  artists: SpotifyArtist[];
  external_urls?: {
    spotify?: string;
  };
}

export interface SpotifySavedTrack {
  added_at: string;
  track: SpotifyTrack;
}

export interface SpotifyPlaylistItem {
  added_at: string | null;
  is_local: boolean;
  track: SpotifyTrack | null;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  collaborative: boolean;
  public: boolean | null;
  uri: string;
  images: SpotifyImage[];
  snapshot_id?: string;
  external_urls?: {
    spotify?: string;
  };
  tracks: {
    total: number;
  };
  owner: {
    display_name: string | null;
  };
}

export interface SpotifyPagedResponse<T> {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

export interface SpotifyProfile {
  id: string;
  display_name: string | null;
  email: string;
  product: string;
  country: string;
  followers: {
    total: number;
  };
  images: SpotifyImage[];
}

export interface SpotifyDevice {
  id: string | null;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
  supports_volume: boolean;
}

export interface SpotifyPlaybackState {
  device: SpotifyDevice;
  repeat_state: string;
  shuffle_state: boolean;
  is_playing: boolean;
  progress_ms: number | null;
  timestamp: number;
  currently_playing_type: string;
  item: SpotifyTrack | null;
}

export interface SpotifyDevicesResponse {
  devices: SpotifyDevice[];
}

export interface SpotifyPlayerResponse {
  playback: SpotifyPlaybackState | null;
  devices: SpotifyDevice[];
}
