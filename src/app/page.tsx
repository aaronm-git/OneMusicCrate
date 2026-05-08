import { redirect } from "next/navigation";

import { LandingPage } from "@/components/marketing/landing-page";
import { getServerSession } from "@/lib/session";

export default async function Home() {
  const session = await getServerSession();

  if (session) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
