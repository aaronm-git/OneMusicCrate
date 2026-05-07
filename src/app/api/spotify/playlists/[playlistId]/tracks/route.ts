import { NextResponse } from "next/server";

import { getRequestSession } from "@/lib/session";
import {
  addTrackToPlaylist,
  getPlaylistItems,
  removeTrackFromPlaylist,
} from "@/lib/spotify";

type RouteContext = {
  params: Promise<{
    playlistId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playlistId } = await context.params;
  const url = new URL(request.url);
  const parsedOffset = Number(url.searchParams.get("offset") ?? "0");
  const parsedLimit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 50;
  const page = await getPlaylistItems(session.user.id, playlistId, offset, limit);

  return NextResponse.json(page);
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playlistId } = await context.params;
  const body = (await request.json()) as {
    trackUri?: string;
  };

  if (!body.trackUri) {
    return NextResponse.json(
      { error: "trackUri is required." },
      { status: 400 }
    );
  }

  const payload = await addTrackToPlaylist(session.user.id, playlistId, body.trackUri);

  return NextResponse.json({ ok: true, snapshotId: payload.snapshot_id });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playlistId } = await context.params;
  const body = (await request.json()) as {
    snapshotId?: string;
    trackUri?: string;
  };

  if (!body.trackUri) {
    return NextResponse.json(
      { error: "trackUri is required." },
      { status: 400 }
    );
  }

  const payload = await removeTrackFromPlaylist(
    session.user.id,
    playlistId,
    body.trackUri,
    body.snapshotId
  );

  return NextResponse.json({ snapshotId: payload.snapshot_id });
}
