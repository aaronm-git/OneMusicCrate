import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-svh">
      {/* Sidebar skeleton */}
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-16" />
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-9 w-full" key={`nav-${index}`} />
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton className="h-12 w-full" key={`pl-${index}`} />
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 bg-app-canvas">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-40 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>

        {/* Hero band */}
        <section className="bg-hero-gradient flex flex-col gap-5 px-10 pb-10 pt-12 sm:flex-row sm:items-end">
          <Skeleton className="size-40 rounded-2xl" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-14 w-3/4 max-w-xl rounded-xl" />
            <Skeleton className="h-4 w-1/2 max-w-md" />
            <Skeleton className="h-4 w-72" />
          </div>
        </section>

        <div className="flex flex-col gap-5 px-10 py-8">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-2/3 max-w-md" />
          <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="flex flex-col gap-3">
              {Array.from({ length: 9 }, (_, index) => (
                <Skeleton className="h-12 w-full" key={`row-${index}`} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
