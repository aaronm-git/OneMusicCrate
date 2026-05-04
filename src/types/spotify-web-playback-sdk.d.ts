declare global {
  interface Window {
    Spotify?: typeof Spotify;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }

  namespace Spotify {
    interface Error {
      message: string;
    }

    interface WebPlaybackPlayerInit {
      name: string;
      getOAuthToken: (callback: (token: string) => void) => void;
      volume?: number;
    }

    interface WebPlaybackTrack {
      id: string | null;
      uri: string;
      name: string;
      duration_ms: number;
      album: {
        name: string;
        uri: string;
        images: Array<{
          url: string;
        }>;
      };
      artists: Array<{
        name: string;
        uri: string;
      }>;
    }

    interface PlaybackState {
      paused: boolean;
      position: number;
      duration: number;
      track_window: {
        current_track: WebPlaybackTrack;
      };
    }

    class Player {
      constructor(init: WebPlaybackPlayerInit);
      connect(): Promise<boolean>;
      disconnect(): void;
      addListener(
        eventName:
          | "ready"
          | "not_ready"
          | "player_state_changed"
          | "initialization_error"
          | "authentication_error"
          | "account_error"
          | "playback_error",
        callback: (
          payload:
            | { device_id: string }
            | PlaybackState
            | Error
            | null
        ) => void
      ): boolean;
      removeListener(eventName?: string): boolean;
      activateElement?(): Promise<void>;
    }
  }
}

export {};
