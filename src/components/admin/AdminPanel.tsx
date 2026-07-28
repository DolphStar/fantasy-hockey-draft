import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface AdminPanelProps {
    title: string;
    /** Short line under the title saying what this tool does to the league. */
    description?: string;
    children: ReactNode;
    className?: string;
}

/**
 * The shell every admin tool sits in.
 *
 * Deliberately *unlike* the rest of the app: square corners, a flat opaque
 * surface instead of glass, tight padding, and a title in the narrow data face
 * rather than the display face the game uses. These tools rewrite scores and
 * delete rosters — they should read as instrumentation you operate, not as part
 * of the product you play. Looking different is the point, not an oversight.
 */
export function AdminPanel({ title, description, children, className }: AdminPanelProps) {
    return (
        <section className={cn('rounded-md border border-ice-seam bg-ice-boards/80', className)}>
            <header className="border-b border-ice-seam px-4 py-2.5">
                <h3 className="font-data text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
                    {title}
                </h3>
                {description && (
                    <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                )}
            </header>
            <div className="space-y-3 p-4">{children}</div>
        </section>
    );
}
