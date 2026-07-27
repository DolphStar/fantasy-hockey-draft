import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export function GradientButton({
    children,
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled,
    ...props
}: GradientButtonProps) {

    // Flat weighted surfaces, not gradients. Each variant is one solid colour
    // plus a hairline top highlight, so buttons read as pressable objects
    // rather than decorated rectangles.
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white border-blue-400/30 shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_6px_16px_-6px_rgba(59,130,246,.7)]",
        secondary: "bg-ice-raise hover:bg-ice-seam text-slate-100 border-paint/25 shadow-[0_1px_0_rgba(148,180,255,.12)_inset]",
        success: "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/30 shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_6px_16px_-6px_rgba(16,185,129,.6)]",
        danger: "bg-red-600 hover:bg-red-500 text-white border-red-400/30 shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_6px_16px_-6px_rgba(239,68,68,.6)]",
        outline: "bg-transparent border-ice-seam hover:bg-ice-raise text-slate-200 hover:text-white hover:border-paint/40",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-5 py-2.5 text-sm",
        lg: "px-8 py-3.5 text-base",
    };

    return (
        <motion.button
            whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
            whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
            className={cn(
                "relative inline-flex items-center justify-center font-bold rounded-lg transition-colors duration-200 border",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paint focus-visible:ring-offset-2 focus-visible:ring-offset-ice-boards",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || isLoading}
            {...props as any}
        >
            {isLoading && (
                <svg className="animate-spin motion-reduce:animate-none -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {children}
        </motion.button>
    );
}
