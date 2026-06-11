import { motion } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils';

interface NavbarProps {
    isNavOpen: boolean;
    setIsNavOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
}

const links = [
    { to: '/', label: 'Home', icon: '🏠', end: true },
    { to: '/players', label: 'Players', icon: '🏒' },
    { to: '/scores', label: 'Scores', icon: '🏆' },
    { to: '/draft', label: 'Draft', icon: '📋' },
    { to: '/league', label: 'League', icon: '⚙️' },
];

export default function Navbar({ isNavOpen, setIsNavOpen }: NavbarProps) {
    const { pathname } = useLocation();
    return (
        <div className="max-w-7xl mx-auto px-4 mb-8 pt-4">
            <div className="flex items-center justify-between md:hidden mb-4">
                <span className="text-slate-200 text-lg font-heading font-bold">Menu</span>
                <button
                    onClick={() => setIsNavOpen((open) => !open)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                >
                    <span>{isNavOpen ? 'Close' : 'Open'}</span>
                    <span className="text-xl">☰</span>
                </button>
            </div>
            <GlassCard className={cn(
                'p-2 flex-col md:flex-row gap-2 md:gap-1 transition-all duration-300',
                isNavOpen ? 'flex' : 'hidden md:flex'
            )}>
                {links.map((link) => {
                    const isActive = link.end ? pathname === link.to : pathname.startsWith(link.to);
                    return (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            onClick={() => setIsNavOpen(false)}
                            className={cn(
                                'relative px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 flex-1 justify-center',
                                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                                    initial={false}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10 text-lg">{link.icon}</span>
                            <span className="relative z-10 text-sm whitespace-nowrap">{link.label}</span>
                        </NavLink>
                    );
                })}
            </GlassCard>
        </div>
    );
}
