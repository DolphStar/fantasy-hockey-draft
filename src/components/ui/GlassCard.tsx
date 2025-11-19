import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
    variant?: 'default' | 'dark' | 'light';
}

export function GlassCard({
    children,
    className,
    hoverEffect = false,
    variant = 'default',
    ...props
}: GlassCardProps) {
    const variants = {
        default: "bg-slate-900/60 border-slate-700/50",
        dark: "bg-black/40 border-white/10",
        light: "bg-white/10 border-white/20",
    };

    return (
        <motion.div
            className={cn(
                "backdrop-blur-md border rounded-xl shadow-xl overflow-hidden",
                variants[variant],
                hoverEffect && "hover:bg-slate-800/60 hover:border-slate-600/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300",
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            {...props as any}
        >
            {children}
        </motion.div>
    );
}
