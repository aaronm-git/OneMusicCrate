import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { requireServerSession } from "@/lib/session";
import { getMusicDashboard, getServiceConnections, getSyncHub } from "@/lib/music-services";
import { musicKeys } from "@/lib/music-query-keys";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardPage() {
  const session = await requireServerSession();
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: musicKeys.services(),
      queryFn: () => getServiceConnections(session.user.id),
    }),
    queryClient.prefetchQuery({
      queryKey: musicKeys.dashboard("greenroom"),
      queryFn: () => getMusicDashboard(session.user.id, "greenroom"),
    }),
    queryClient.prefetchQuery({
      queryKey: musicKeys.syncHub(),
      queryFn: () => getSyncHub(session.user.id),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardShell initialPlayback={null} />
    </HydrationBoundary>
  );
}
