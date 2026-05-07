import { NextResponse } from "next/server";

import {
  getServicePlayer,
  runServicePlayerAction,
} from "@/lib/music-services";
import { getRequestSession } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    service: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { service } = await context.params;

  return NextResponse.json(await getServicePlayer(session.user.id, service));
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { service } = await context.params;
  const body = (await request.json()) as {
    action?: string;
    contextUri?: string;
    deviceId?: string;
    trackUri?: string;
    positionMs?: number;
    volumePercent?: number;
    play?: boolean;
  };

  await runServicePlayerAction(session.user.id, service, body);

  return NextResponse.json({ ok: true });
}
