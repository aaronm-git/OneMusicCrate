import { requireServerSession } from "@/lib/session";
import {
  getCurrentPlayback,
  getPlaylists,
  getSavedTracks,
  getSpotifyProfile,
} from "@/lib/spotify";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardPage() {
  const session = await requireServerSession();
  const notices: string[] = [];

  const [profileResult, savedTracksResult, playlistsResult, playbackResult] =
    await Promise.allSettled([
      getSpotifyProfile(session.user.id),
      getSavedTracks(session.user.id),
      getPlaylists(session.user.id),
      getCurrentPlayback(session.user.id),
    ]);

  if (profileResult.status !== "fulfilled") {
    throw new Error("Unable to load the listener profile for the current user.");
  }

  if (savedTracksResult.status !== "fulfilled") {
    notices.push("Saved tracks could not be loaded from your provider in this request.");
  }

  if (playlistsResult.status !== "fulfilled") {
    notices.push("Playlists could not be loaded from your provider in this request.");
  }

  if (playbackResult.status !== "fulfilled") {
    notices.push("Current playback state is unavailable until a streaming device is active.");
  }

  return (
    <DashboardShell
      initialPlayback={
        playbackResult.status === "fulfilled" ? playbackResult.value : null
      }
      notices={notices}
      playlists={
        playlistsResult.status === "fulfilled" ? playlistsResult.value : []
      }
      profile={profileResult.value}
      savedTracks={
        savedTracksResult.status === "fulfilled" ? savedTracksResult.value : []
      }
    />
  );
}
