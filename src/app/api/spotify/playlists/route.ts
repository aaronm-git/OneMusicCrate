import { NextResponse } from "next/server";

import { getRequestSession } from "@/lib/session";
import { createPlaylist, getPlaylists } from "@/lib/spotify";

export async function GET(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const playlists = await getPlaylists(session.user.id);

  return NextResponse.json({ playlists });
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
  };

  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "A playlist name is required." },
      { status: 400 }
    );
  }

  const playlist = await createPlaylist(
    session.user.id,
    name,
    body.description?.trim() ?? ""
  );

  return NextResponse.json({ playlist });
}
