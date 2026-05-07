import { NextResponse } from "next/server";

import { getMusicDashboard } from "@/lib/music-services";
import { getRequestSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const payload = await getMusicDashboard(
    session.user.id,
    url.searchParams.get("service")
  );

  return NextResponse.json(payload);
}
