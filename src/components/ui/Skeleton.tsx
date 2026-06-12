import { cn } from '../../lib/utils';

/** Base shimmer block. Size it with className (h-*, w-*). */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={cn(
                'rounded-lg bg-[linear-gradient(90deg,#131c30_25%,#1c2840_50%,#131c30_75%)] bg-[length:200%_100%] animate-shimmer motion-reduce:animate-none',
                className,
            )}
        />
    );
}

/** Avatar + two lines + trailing stat — shape of list rows (pickups, standings). */
export function SkeletonRow() {
    return (
        <div className="flex items-center gap-3 px-4 py-2.5">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-1/3" />
            </div>
            <Skeleton className="h-4 w-10 shrink-0" />
        </div>
    );
}

/** Player-card shape for the Players grid. */
export function SkeletonCard() {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-2/3 mx-auto" />
                <Skeleton className="h-3 w-1/2 mx-auto" />
                <Skeleton className="h-7 w-16 mx-auto" />
            </div>
        </div>
    );
}
