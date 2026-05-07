import { NextResponse } from "next/server";

import { createServicePlaylist } from "@/lib/music-services";
import { getRequestSession } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    service: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { service } = await context.params;
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

  const playlist = await createServicePlaylist(
    session.user.id,
    service,
    name,
    body.description?.trim() ?? ""
  );

  return NextResponse.json({ playlist });
}
