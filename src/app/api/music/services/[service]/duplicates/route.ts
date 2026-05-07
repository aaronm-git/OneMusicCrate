import { NextResponse } from "next/server";

import {
  cleanupServiceDuplicates,
  getServiceDuplicates,
  type DuplicateCleanupSelection,
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

  return NextResponse.json(await getServiceDuplicates(session.user.id, service));
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { service } = await context.params;
  const body = (await request.json()) as {
    groups?: DuplicateCleanupSelection[];
  };

  if (!Array.isArray(body.groups)) {
    return NextResponse.json(
      { error: "groups is required." },
      { status: 400 }
    );
  }

  const hasInvalidSelection = body.groups.some(
    (group) =>
      !group ||
      typeof group.keepProviderTrackId !== "string" ||
      !group.keepProviderTrackId ||
      !Array.isArray(group.removeProviderTrackIds) ||
      group.removeProviderTrackIds.some(
        (providerTrackId) => typeof providerTrackId !== "string"
      )
  );

  if (hasInvalidSelection) {
    return NextResponse.json(
      {
        error:
          "Each cleanup group requires keepProviderTrackId and removeProviderTrackIds.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    await cleanupServiceDuplicates(session.user.id, service, body.groups)
  );
}
