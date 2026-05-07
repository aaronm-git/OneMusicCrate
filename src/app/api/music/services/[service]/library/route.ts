import { NextResponse } from "next/server";

import { saveServiceLibraryTrack } from "@/lib/music-services";
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
    providerTrackId?: string;
    shouldSave?: boolean;
  };

  if (!body.providerTrackId || typeof body.shouldSave !== "boolean") {
    return NextResponse.json(
      { error: "providerTrackId and shouldSave are required." },
      { status: 400 }
    );
  }

  await saveServiceLibraryTrack(
    session.user.id,
    service,
    body.providerTrackId,
    body.shouldSave
  );

  return NextResponse.json({ ok: true });
}
