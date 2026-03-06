import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-64 bg-zinc-800" />
                <Skeleton className="h-4 w-96 bg-zinc-800/60" />
            </div>

            {/* Stats cards skeleton */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3"
                    >
                        <Skeleton className="h-4 w-24 bg-zinc-800" />
                        <Skeleton className="h-7 w-32 bg-zinc-800/60" />
                        <Skeleton className="h-3 w-20 bg-zinc-800/40" />
                    </div>
                ))}
            </div>

            {/* Table skeleton */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="border-b border-zinc-800 p-4">
                    <Skeleton className="h-5 w-40 bg-zinc-800" />
                </div>
                <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <Skeleton className="h-4 w-32 bg-zinc-800/60" />
                            <Skeleton className="h-4 flex-1 bg-zinc-800/40" />
                            <Skeleton className="h-4 w-24 bg-zinc-800/60" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
