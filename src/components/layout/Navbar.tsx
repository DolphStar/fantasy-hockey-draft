import { motion } from 'framer-motion';
import type { Tab } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils';

interface NavbarProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    isNavOpen: boolean;
    setIsNavOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
}

export default function Navbar({ activeTab, setActiveTab, isNavOpen, setIsNavOpen }: NavbarProps) {
    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'roster', label: 'NHL Rosters', icon: '🏒' },
        { id: 'draftBoard', label: 'Draft Board', icon: '📋' },
        { id: 'myPlayers', label: 'My Players', icon: '👥' },
        { id: 'standings', label: 'Standings', icon: '🏆' },
        { id: 'injuries', label: 'Injuries', icon: '🏥' },
        { id: 'chat', label: 'Chat', icon: '💬' },
        { id: 'leagueSettings', label: 'League', icon: '⚙️' },
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 mb-8 pt-4">
            {/* Mobile Header */}
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

            {/* Desktop & Mobile Nav */}
            <GlassCard
                className={cn(
                    "p-2 flex-col md:flex-row gap-2 md:gap-1 transition-all duration-300",
                    isNavOpen ? 'flex' : 'hidden md:flex'
                )}
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            setIsNavOpen(false);
                        }}
                        className={cn(
                            "relative px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 flex-1 justify-center",
                            activeTab === tab.id
                                ? "text-white"
                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                        )}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                                initial={false}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10 text-lg">{tab.icon}</span>
                        <span className="relative z-10 text-sm whitespace-nowrap">{tab.label}</span>
                    </button>
                ))}
            </GlassCard>
        </div>
    );
}
