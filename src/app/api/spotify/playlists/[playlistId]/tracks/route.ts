import { NextResponse } from "next/server";

import { getRequestSession } from "@/lib/session";
import { addTrackToPlaylist } from "@/lib/spotify";

type RouteContext = {
  params: Promise<{
    playlistId: string;
  }>;
};

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

  await addTrackToPlaylist(session.user.id, playlistId, body.trackUri);

  return NextResponse.json({ ok: true });
}
