import { cn } from "../../lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
    variant?: 'default' | 'dark' | 'light';
    /**
     * How far off the ice this surface sits. Pick one per page:
     * `flat` for supporting chrome (filters, toolbars, form rows), `raised` for
     * the working default, `hero` for the single thing the page is about.
     */
    elevation?: 'flat' | 'raised' | 'hero';
}

export function GlassCard({
    children,
    className,
    hoverEffect = false,
    variant = 'default',
    elevation = 'raised',
    ...props
}: GlassCardProps) {
    const variants = {
        default: "bg-gradient-to-br from-ice-raise/70 to-ice-deep/90 border-paint/15",
        dark: "bg-ice-boards/50 border-white/10",
        light: "bg-white/10 border-white/20",
    };

    // Elevation carries weight three ways at once — shadow depth, border
    // brightness and blur — so the difference reads without a size change.
    const elevations = {
        flat: "shadow-flat backdrop-blur-sm",
        raised: "shadow-glass backdrop-blur-md",
        hero: "shadow-hero backdrop-blur-lg border-paint/30",
    };

    // Deliberately not animated. Every card fading up on mount meant a dozen
    // independent 0.4s reveals on each navigation, which made nothing feel like
    // an event — the page as a whole already fades in via `pageEnter` in
    // AppShell. Motion is reserved for things that actually happened: a pick
    // landing on the draft board, a lead changing in the standings.
    return (
        <div
            className={cn(
                "border rounded-xl overflow-hidden",
                variants[variant],
                elevations[elevation],
                hoverEffect && "hover:-translate-y-[3px] hover:border-blue-400/45 hover:shadow-glass-hover transition-all duration-300",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
