import { NextResponse } from "next/server";

import { getSyncHub } from "@/lib/music-services";
import { getRequestSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getSyncHub(session.user.id));
}
