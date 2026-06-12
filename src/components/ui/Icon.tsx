import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

const sizes = { sm: 16, md: 20, lg: 24 } as const;

interface IconProps {
    as: LucideIcon;
    size?: keyof typeof sizes;
    /** Adds a soft drop-shadow glow in the icon's currentColor */
    glow?: boolean;
    className?: string;
}

/** Single wrapper for all chrome icons — keeps size and glow language consistent. */
export function Icon({ as: LucideComponent, size = 'md', glow = false, className }: IconProps) {
    return (
        <LucideComponent
            size={sizes[size]}
            strokeWidth={2.2}
            aria-hidden
            className={cn(glow && 'drop-shadow-[0_0_6px_currentColor]', className)}
        />
    );
}
