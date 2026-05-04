import { NextResponse } from "next/server";

import { getRequestSession } from "@/lib/session";
import { getSpotifySdkToken } from "@/lib/spotify";

export async function GET(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getSpotifySdkToken(session.user.id);

  return NextResponse.json({ accessToken });
}
