import { getInjuryIcon } from '../../services/injuryService';
import { cn } from '../../lib/utils';
import PlayerSparkline from './PlayerSparkline';
import PlayerGameLogPopup from './PlayerGameLogPopup';
import { useState } from 'react';

// Position color logic - User Defined Palette
const getPositionTheme = (pos: string) => {
    if (['C', 'L', 'R'].includes(pos)) return {
        color: "cyan-400",
        rgb: "0,234,255",
        graph: "#00eaff"
    };
    if (pos === 'D') return {
        color: "blue-400",
        rgb: "96,165,250",
        graph: "#60a5fa"
    };
    if (pos === 'G') return {
        color: "green-400",
        rgb: "74,222,128",
        graph: "#4ade80"
    };
    return {
        color: "gray-400",
        rgb: "156,163,175",
        graph: "#9ca3af"
    };
};

interface MyPlayerCardProps {
    player: {
        id: string;
        playerId: string;
        name: string;
        position: string;
        positionName: string;
        nhlTeam: string;
        jerseyNumber: number;
        round: number;
        pickNumber: number;
        rosterSlot: 'active' | 'reserve';
        pendingSlot?: 'active' | 'reserve' | null;
    };
    fantasyPoints?: number;
    stats?: { goals: number; assists: number; gamesPlayed: number; avgPoints: number };
    history?: { points: number }[];
    injury?: { status: string };
    // Swap props
    onSwap?: (player: any) => void;
    onCancelSwap?: (player: any) => void;
    isSelected?: boolean;
    isOverlay?: boolean;
}

export default function MyPlayerCard({
    player,
    fantasyPoints = 0,
    stats = { goals: 0, assists: 0, gamesPlayed: 0, avgPoints: 0 },
    history = [],
    injury,
    onSwap,
    onCancelSwap,
    isSelected,
    isOverlay = false,
}: MyPlayerCardProps) {
    const [showPopup, setShowPopup] = useState(false);
    const teamAbbrev = player.nhlTeam || 'UNK';
    const headshotUrl = `https://assets.nhle.com/mugs/nhl/20242025/${teamAbbrev}/${player.playerId}.png`;
    const fallbackHeadshot = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
    const teamLogoUrl = `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_light.svg`;
    const theme = getPositionTheme(player.position);

    // Color-code AVG based on performance
    const getAvgColor = (avg: number) => {
        if (avg >= 2.0) return 'text-green-400';
        if (avg >= 1.0) return 'text-yellow-400';
        if (avg >= 0.5) return 'text-orange-400';
        return 'text-red-400';
    };

    // Color-code fantasy points based on score
    const getFpColor = (fp: number) => {
        if (fp >= 15) return { text: 'text-amber-400', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]' };
        if (fp >= 10) return { text: 'text-green-400', glow: 'shadow-[0_0_20px_rgba(74,222,128,0.6)]' };
        if (fp >= 5) return { text: 'text-blue-400', glow: 'shadow-[0_0_20px_rgba(96,165,250,0.6)]' };
        return { text: 'text-gray-400', glow: 'shadow-[0_0_10px_rgba(156,163,175,0.4)]' };
    };

    const fpColor = getFpColor(fantasyPoints);

    // Calculate running average for graph
    const avgHistory = history.length > 0 ? history.map((_, idx) => {
        const subset = history.slice(0, idx + 1);
        const sum = subset.reduce((acc, curr) => acc + (curr.points || 0), 0);
        const avg = subset.length > 0 ? sum / subset.length : 0;
        return { points: isNaN(avg) ? 0 : avg };
    }) : [];

    // Prepare game log data for popup
    const recentGames = history.slice(-5).map((h: any) => ({
        date: h.date || new Date().toISOString(),
        points: h.points || 0,
        opponent: h.opponent
    }));

    // Calculate projected points (recent 5-game average)
    const projectedPoints = recentGames.length > 0
        ? recentGames.reduce((sum, g) => sum + g.points, 0) / recentGames.length
        : stats.avgPoints || 0;

    return (
        <div
            className={cn(
                'relative group transition-all duration-300 h-[420px] w-full',
                isSelected ? 'scale-[1.02] z-10' : 'hover:scale-[1.02] hover:-translate-y-1',
                (onSwap || isSelected) && 'cursor-pointer'
            )}
            onClick={(e) => {
                e.stopPropagation();
                if (isSelected && onCancelSwap) {
                    onCancelSwap(player);
                } else if (onSwap) {
                    onSwap(player);
                }
            }}
            onMouseEnter={() => !isOverlay && setShowPopup(true)}
            onMouseLeave={() => setShowPopup(false)}
            onTouchStart={() => !isOverlay && setShowPopup(true)}
            onTouchEnd={() => setTimeout(() => setShowPopup(false), 3000)}
        >
            {/* Game Log Popup - Don't show on drag overlay */}
            {showPopup && !isOverlay && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
                    <PlayerGameLogPopup
                        recentGames={recentGames}
                        projectedPoints={projectedPoints}
                        injury={injury}
                        notes={player.rosterSlot === 'reserve' ? ['Reserve player'] : []}
                    />
                </div>
            )}
            {/* Main Card Container */}
            <div
                className={cn(
                    'h-full w-full rounded-2xl overflow-hidden relative flex flex-col',
                    'border-4 transition-all duration-300',
                    isSelected
                        ? 'border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.6),0_0_60px_rgba(251,191,36,0.3)]'
                        : 'border-amber-400/80 hover:border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:shadow-[0_0_25px_rgba(251,191,36,0.5)]'
                )}
                style={{
                    background: `radial-gradient(ellipse at center, rgba(${theme.rgb}, 0.15) 0%, #0f172a 40%, #020617 100%)`
                }}
            >
                {/* Noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none z-0 mix-blend-overlay"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
                />

                {/* Team Logo Blend */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-0 mix-blend-overlay overflow-hidden">
                    <img src={teamLogoUrl} alt="Team Logo" className="w-full h-full object-contain scale-[1.85]" />
                </div>

                {/* Dramatic Light Rays */}
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.03)_10deg,transparent_20deg,rgba(255,255,255,0.03)_30deg,transparent_40deg)] animate-spin-slow pointer-events-none z-0 opacity-30" />
                <div className="absolute inset-0 pointer-events-none z-0"
                    style={{
                        background: `linear-gradient(135deg, transparent 0%, rgba(${theme.rgb}, 0.1) 30%, transparent 60%),
                                     linear-gradient(-45deg, transparent 0%, rgba(251,191,36,0.05) 40%, transparent 70%)`
                    }}
                />
                {/* Top Section: Image and Badges */}
                <div className="relative h-64 w-full overflow-visible shrink-0">
                    {/* Shield Position Badge */}
                    <div
                        className={cn(
                            'absolute top-3 right-3 z-30 w-12 h-14 flex items-center justify-center shadow-[0_4px_6px_rgba(0,0,0,0.3)]',
                            `bg-gradient-to-b from-slate-400 via-${theme.color} to-slate-900 text-white`
                        )}
                        style={{
                            clipPath: 'polygon(50% 0%, 100% 20%, 100% 85%, 50% 100%, 0% 85%, 0% 20%)'
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none mix-blend-overlay" />
                        <div className="absolute inset-[1px] bg-slate-900 z-0" style={{ clipPath: 'polygon(50% 0%, 100% 20%, 100% 85%, 50% 100%, 0% 85%, 0% 20%)' }} />
                        <div className={cn("absolute inset-[2px] z-0 bg-gradient-to-br from-slate-700 to-slate-900", `from-${theme.color}/50 to-slate-900`)} style={{ clipPath: 'polygon(50% 0%, 100% 20%, 100% 85%, 50% 100%, 0% 85%, 0% 20%)' }} />
                        <span className="font-black font-heading text-lg drop-shadow-md mt-[-2px] relative z-10">
                            {player.position}
                        </span>
                    </div>

                    {/* Injury Badge */}
                    {injury && (
                        <div className="absolute top-3 left-3 z-20">
                            <div className="bg-red-500/20 border border-red-500 text-red-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 backdrop-blur-md shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                                {getInjuryIcon(injury.status)}{' '}
                                {injury.status === 'Injured Reserve' ? 'IR' : 'INJ'}
                            </div>
                        </div>
                    )}

                    {/* Player Image - Larger */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-full h-full flex items-start justify-center z-10">
                        <img
                            src={headshotUrl}
                            alt={player.name}
                            loading="lazy"
                            onError={(e) => {
                                e.currentTarget.src = fallbackHeadshot;
                            }}
                            className="w-64 h-64 object-cover object-top drop-shadow-[0_0_30px_rgba(0,0,0,0.9)]"
                            style={{
                                maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                            }}
                        />
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 flex flex-col px-4 pb-3 relative z-20 mt-[-20px]">
                    {/* Name - HUGE Typography */}
                    <div className="text-center w-full mb-3">
                        <h3 className="text-white/70 font-heading font-medium text-sm uppercase tracking-[0.3em] leading-none mb-1 drop-shadow-md">
                            {player.name.split(' ')[0]}
                        </h3>
                        <h2 className="text-white font-heading font-black text-4xl uppercase tracking-wider leading-none drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                            {player.name.split(' ').slice(1).join(' ')}
                        </h2>
                    </div>

                    {/* Stats Pill - Dark Glossy with Lightning Icons */}
                    <div className="flex items-center justify-center gap-3 text-xs font-bold tracking-wider text-gray-300 bg-black/60 backdrop-blur-xl py-2 px-5 rounded-full mx-auto w-fit border border-white/20 shadow-lg mb-auto relative overflow-hidden">
                        {/* Inner glow */}
                        <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                        <span className="flex items-center gap-1">
                            <span className="text-gray-400">G:</span>
                            <span className="text-white">{stats?.goals ?? 0}</span>
                        </span>
                        <span className="text-yellow-400">⚡</span>
                        <span className="flex items-center gap-1">
                            <span className="text-gray-400">A:</span>
                            <span className="text-white">{stats?.assists ?? 0}</span>
                        </span>
                        <span className="text-yellow-400">⚡</span>
                        <span className="flex items-center gap-1">
                            <span className="text-gray-400">AVG:</span>
                            <span className={getAvgColor(stats?.avgPoints ?? 0)}>{stats?.avgPoints?.toFixed(1) ?? '0.0'}</span>
                        </span>
                    </div>

                    {/* Stats Area */}
                    <div className="w-full flex items-center justify-between mb-3 mt-auto transition-transform duration-300 group-hover:translate-y-[-2px]">
                        {/* Line Graph - Running Average */}
                        {avgHistory.length > 0 ? (
                            <div className="h-8 w-16 relative opacity-80">
                                <PlayerSparkline data={avgHistory} color="#ffffff" />
                            </div>
                        ) : (
                            <div className="h-8 w-16 border-b border-gray-600 flex items-end">
                                <span className="text-[8px] text-gray-500">No data</span>
                            </div>
                        )}

                        {/* Fantasy Points - Large with Color Coding */}
                        <div className="text-right flex items-baseline gap-2">
                            <div className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">
                                Fantasy Points:
                            </div>
                            <div className={cn("text-5xl font-black leading-none bg-transparent", fpColor.text)}>
                                {fantasyPoints.toFixed(0)}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons - Blue Glowing */}
                    {player.pendingSlot ? (
                        <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 w-[85%] z-30">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCancelSwap?.(player);
                                }}
                                className={cn(
                                    'w-full py-3 rounded-full',
                                    'font-black uppercase tracking-[0.2em] text-sm text-white',
                                    'flex items-center justify-center gap-2',
                                    'bg-gradient-to-b from-amber-400 to-amber-600',
                                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_10px_rgba(0,0,0,0.5)]',
                                    'border border-amber-300/30',
                                    'transition-all duration-300',
                                    'hover:scale-[1.02] hover:brightness-110 hover:shadow-[0_0_20px_rgba(251,191,36,0.6)]',
                                    'active:scale-95'
                                )}
                            >
                                {/* Clock Icon */}
                                <svg className="w-4 h-4 text-amber-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="drop-shadow-md">Pending Swap</span>
                            </button>
                        </div>
                    ) : (
                        <div className="absolute bottom-[-120px] left-1/2 -translate-x-1/2 w-[85%] z-30 opacity-0 group-hover:opacity-100 group-hover:bottom-[-24px] transition-all duration-300 pointer-events-none">
                            {/* Button removed, functionality moved to card click */}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
