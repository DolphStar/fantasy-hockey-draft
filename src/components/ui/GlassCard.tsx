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
        default: "bg-gradient-to-br from-slate-800/55 to-[#0d1322]/85 border-blue-400/20 shadow-glass",
        dark: "bg-black/40 border-white/10 shadow-glass",
        light: "bg-white/10 border-white/20",
    };

    return (
        <motion.div
            className={cn(
                "backdrop-blur-md border rounded-xl overflow-hidden",
                variants[variant],
                hoverEffect && "hover:-translate-y-[3px] hover:border-blue-400/45 hover:shadow-glass-hover transition-all duration-300",
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
