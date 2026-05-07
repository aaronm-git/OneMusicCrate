import { NextResponse } from "next/server";

import { syncService } from "@/lib/music-services";
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

  return NextResponse.json(await syncService(session.user.id, service));
}
