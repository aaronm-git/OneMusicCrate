import { NextResponse } from "next/server";

import { getRequestSession } from "@/lib/session";
import { removeTrack, saveTrack } from "@/lib/spotify";

export async function POST(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    trackId?: string;
    shouldSave?: boolean;
  };

  if (!body.trackId || typeof body.shouldSave !== "boolean") {
    return NextResponse.json(
      { error: "trackId and shouldSave are required." },
      { status: 400 }
    );
  }

  if (body.shouldSave) {
    await saveTrack(session.user.id, body.trackId);
  } else {
    await removeTrack(session.user.id, body.trackId);
  }

  return NextResponse.json({ ok: true });
}
