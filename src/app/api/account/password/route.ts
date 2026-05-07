import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getAuth } from "@/lib/auth";
import { getAccountPayload } from "@/lib/music-services";
import { getRequestSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getAccountPayload(session.user.id);

  return NextResponse.json({ hasPassword: account.hasPassword });
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  const newPassword = body.newPassword?.trim() ?? "";
  const confirmPassword = body.confirmPassword?.trim() ?? "";

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Password confirmation does not match." },
      { status: 400 }
    );
  }

  const account = await getAccountPayload(session.user.id);
  const auth = getAuth();

  if (account.hasPassword) {
    if (!body.currentPassword) {
      return NextResponse.json(
        { error: "Current password is required." },
        { status: 400 }
      );
    }

    await auth.api.changePassword({
      body: {
        currentPassword: body.currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } else {
    await auth.api.setPassword({
      body: {
        newPassword,
      },
      headers: await headers(),
    });
  }

  return NextResponse.json({ ok: true });
}
