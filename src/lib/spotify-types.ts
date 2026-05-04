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
  duration_ms: number;
  explicit: boolean;
  preview_url: string | null;
  album: SpotifyAlbum;
  artists: SpotifyArtist[];
}

export interface SpotifySavedTrack {
  added_at: string;
  track: SpotifyTrack;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  collaborative: boolean;
  public: boolean | null;
  uri: string;
  images: SpotifyImage[];
  tracks: {
    total: number;
  };
  owner: {
    display_name: string | null;
  };
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
