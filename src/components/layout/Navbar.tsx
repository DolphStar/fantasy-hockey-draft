import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { ClipboardList, House, Settings, Trophy, Users, type LucideIcon } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Icon } from '../ui/Icon';
import { cn } from '../../lib/utils';

const links: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/players', label: 'Players', icon: Users },
    { to: '/scores', label: 'Scores', icon: Trophy },
    { to: '/draft', label: 'Draft', icon: ClipboardList },
    { to: '/league', label: 'League', icon: Settings },
];

export default function Navbar() {
    return (
        <div className="hidden md:block max-w-7xl mx-auto px-4 mb-8 pt-4">
            <GlassCard className="p-2 flex gap-1">
                {links.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        className={({ isActive }) => cn(
                            'relative px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 flex-1 justify-center',
                            isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10"><Icon as={link.icon} size="sm" glow={isActive} /></span>
                                <span className="relative z-10 text-sm whitespace-nowrap">{link.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </GlassCard>
        </div>
    );
}
