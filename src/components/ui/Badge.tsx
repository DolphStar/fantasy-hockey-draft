import { cn } from "../../lib/utils";

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info' | 'solid-red' | 'solid-blue' | 'solid-green';
    className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
    const variants = {
        default: "bg-slate-700 text-slate-200",
        outline: "bg-transparent border border-slate-600 text-slate-300",
        success: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
        warning: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
        danger: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
        info: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
        // Solid variants for positions
        "solid-red": "bg-red-600 text-white border border-red-500",
        "solid-blue": "bg-blue-600 text-white border border-blue-500",
        "solid-green": "bg-green-600 text-white border border-green-500",
    };

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm",
            variants[variant],
            className
        )}>
            {children}
        </span>
    );
}
