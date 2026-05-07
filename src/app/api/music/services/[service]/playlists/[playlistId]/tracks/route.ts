import { NextResponse } from "next/server";

import {
  addServicePlaylistTrack,
  getServicePlaylistTracks,
  removeServicePlaylistTrack,
} from "@/lib/music-services";
import { getRequestSession } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    playlistId: string;
    service: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playlistId, service } = await context.params;
  const url = new URL(request.url);
  const parsedOffset = Number(url.searchParams.get("offset") ?? "0");
  const parsedLimit = Number(url.searchParams.get("limit") ?? "50");

  return NextResponse.json(
    await getServicePlaylistTracks(
      session.user.id,
      service,
      playlistId,
      Number.isFinite(parsedOffset) ? parsedOffset : 0,
      Number.isFinite(parsedLimit) ? parsedLimit : 50
    )
  );
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playlistId, service } = await context.params;
  const body = (await request.json()) as {
    trackUri?: string;
  };

  if (!body.trackUri) {
    return NextResponse.json(
      { error: "trackUri is required." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    await addServicePlaylistTrack(session.user.id, service, playlistId, body.trackUri)
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playlistId, service } = await context.params;
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

  return NextResponse.json(
    await removeServicePlaylistTrack(
      session.user.id,
      service,
      playlistId,
      body.trackUri,
      body.snapshotId
    )
  );
}
