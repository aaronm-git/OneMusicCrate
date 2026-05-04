import { NextResponse } from "next/server";

import { getRequestSession } from "@/lib/session";
import {
  getAvailableDevices,
  getCurrentPlayback,
  pausePlayback,
  playTrack,
  resumePlayback,
  seekPlayback,
  setPlaybackVolume,
  skipToNextTrack,
  skipToPreviousTrack,
  transferPlayback,
} from "@/lib/spotify";

export async function GET(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [playback, devices] = await Promise.all([
    getCurrentPlayback(session.user.id),
    getAvailableDevices(session.user.id),
  ]);

  return NextResponse.json({
    playback,
    devices,
  });
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    deviceId?: string;
    trackUri?: string;
    positionMs?: number;
    volumePercent?: number;
    play?: boolean;
  };

  switch (body.action) {
    case "transfer":
      if (!body.deviceId) {
        return NextResponse.json(
          { error: "deviceId is required." },
          { status: 400 }
        );
      }

      await transferPlayback(session.user.id, body.deviceId, body.play);
      break;
    case "play-track":
      if (!body.trackUri) {
        return NextResponse.json(
          { error: "trackUri is required." },
          { status: 400 }
        );
      }

      await playTrack(session.user.id, body.trackUri, body.deviceId);
      break;
    case "resume":
      await resumePlayback(session.user.id, body.deviceId);
      break;
    case "pause":
      await pausePlayback(session.user.id, body.deviceId);
      break;
    case "next":
      await skipToNextTrack(session.user.id, body.deviceId);
      break;
    case "previous":
      await skipToPreviousTrack(session.user.id, body.deviceId);
      break;
    case "seek":
      if (typeof body.positionMs !== "number") {
        return NextResponse.json(
          { error: "positionMs is required." },
          { status: 400 }
        );
      }

      await seekPlayback(session.user.id, body.positionMs, body.deviceId);
      break;
    case "volume":
      if (typeof body.volumePercent !== "number") {
        return NextResponse.json(
          { error: "volumePercent is required." },
          { status: 400 }
        );
      }

      await setPlaybackVolume(session.user.id, body.volumePercent, body.deviceId);
      break;
    default:
      return NextResponse.json(
        { error: "Unsupported player action." },
        { status: 400 }
      );
  }

  return NextResponse.json({ ok: true });
}
