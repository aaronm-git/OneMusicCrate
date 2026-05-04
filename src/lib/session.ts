import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";

export async function getServerSession() {
  return getAuth().api.getSession({
    headers: await headers(),
  });
}

export async function requireServerSession() {
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  return session;
}

export async function getRequestSession(request: Request) {
  return getAuth().api.getSession({
    headers: request.headers,
  });
}
