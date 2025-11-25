import { cn } from '../../lib/utils';

import PlayerGameLogPopup from './PlayerGameLogPopup';
import { useState } from 'react';

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
    isPlayingToday?: boolean;
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
    isPlayingToday = false,
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

    // Color-code AVG based on performance (Updated to Cyan/Blue per user request)
    const getAvgColor = (avg: number) => {
        if (avg >= 2.0) return 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]';
        if (avg >= 1.0) return 'text-blue-400';
        if (avg >= 0.5) return 'text-blue-300';
        return 'text-slate-400';
    };

    // Color-code fantasy points based on score
    const getFpColor = (fp: number) => {
        if (fp >= 15) return { text: 'text-amber-400', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]' };
        if (fp >= 10) return { text: 'text-green-400', glow: 'shadow-[0_0_20px_rgba(74,222,128,0.6)]' };
        if (fp >= 5) return { text: 'text-blue-400', glow: 'shadow-[0_0_20px_rgba(96,165,250,0.6)]' };
        return { text: 'text-gray-400', glow: 'shadow-[0_0_10px_rgba(156,163,175,0.4)]' };
    };

    const fpColor = getFpColor(fantasyPoints);



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

    // 3D Tilt Effect State
    const [rotateX, setRotateX] = useState(0);
    const [rotateY, setRotateY] = useState(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isOverlay) return;
        const card = e.currentTarget;
        const box = card.getBoundingClientRect();
        const x = e.clientX - box.left;
        const y = e.clientY - box.top;
        const centerX = box.width / 2;
        const centerY = box.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        setRotateX(rotateX);
        setRotateY(rotateY);
    };

    const handleMouseLeave = () => {
        setRotateX(0);
        setRotateY(0);
        setShowPopup(false);
    };

    // Holographic Foil for Top Players (e.g., > 15 FP or specific rank)
    const isTopPlayer = fantasyPoints >= 15;

    return (
        <div
            className={cn(
                'relative group transition-all duration-300 h-[420px] w-full perspective-1000',
                isSelected ? 'z-10' : 'hover:z-20',
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
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseEnter={() => !isOverlay && setShowPopup(true)}
            onTouchStart={() => !isOverlay && setShowPopup(true)}
            onTouchEnd={() => setTimeout(() => setShowPopup(false), 3000)}
            style={{
                transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
                transition: 'transform 0.1s ease-out'
            }}
        >
            {/* Game Log Popup - Don't show on drag overlay */}
            {showPopup && !isOverlay && (
                <div className="absolute top-[75%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                    <PlayerGameLogPopup
                        recentGames={recentGames}
                        projectedPoints={projectedPoints}
                        totalPoints={fantasyPoints}
                        injury={injury}
                        notes={player.rosterSlot === 'reserve' ? ['Reserve player'] : []}
                    />
                </div>
            )}
            {/* Main Card Container */}
            <div
                className={cn(
                    'h-full w-full rounded-2xl overflow-visible relative flex flex-col',
                    'border-2 transition-all duration-300 bg-slate-900',
                    'hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/20',
                    isSelected
                        ? 'border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.6),0_0_60px_rgba(251,191,36,0.3)]'
                        : 'border-slate-700/50 hover:border-blue-400/70 shadow-xl'
                )}
                style={{
                    background: '#0f172a'
                }}
            >
                {/* Holographic Foil Overlay */}
                {isTopPlayer && (
                    <div
                        className="absolute inset-0 rounded-xl opacity-20 pointer-events-none z-10 mix-blend-color-dodge"
                        style={{
                            background: `linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.0) 50%, rgba(255,255,255,0.4) 55%, transparent 100%)`,
                            backgroundSize: '200% 200%',
                            animation: 'holo-sheen 3s ease infinite'
                        }}
                    />
                )}

                {/* Noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none z-0 mix-blend-overlay rounded-xl"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
                />

                {/* Team Logo Blend */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-0 mix-blend-overlay overflow-hidden rounded-xl">
                    <img src={teamLogoUrl} alt="Team Logo" className="w-full h-full object-contain scale-[1.85]" />
                </div>

                {/* Top Section: Image and Badges */}
                <div className="relative h-64 w-full overflow-visible shrink-0">
                    {/* Shield Position Badge */}
                    <div
                        className={cn(
                            'absolute top-3 right-3 z-30 w-12 h-14 flex items-center justify-center shadow-[0_4px_6px_rgba(0,0,0,0.3)]',
                            // Color coding: F=blue-600, D=emerald-500, G=amber-400
                            ['C', 'L', 'R'].includes(player.position) ? 'bg-gradient-to-b from-blue-400 via-blue-600 to-slate-900' :
                                player.position === 'D' ? 'bg-gradient-to-b from-emerald-300 via-emerald-500 to-slate-900' :
                                    'bg-gradient-to-b from-amber-300 via-amber-400 to-slate-900'
                        )}
                        style={{
                            clipPath: 'polygon(50% 0%, 100% 20%, 100% 85%, 50% 100%, 0% 85%, 0% 20%)'
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none mix-blend-overlay" />
                        <div className="absolute inset-[1px] bg-slate-900 z-0" style={{ clipPath: 'polygon(50% 0%, 100% 20%, 100% 85%, 50% 100%, 0% 85%, 0% 20%)' }} />
                        <div
                            className={cn(
                                "absolute inset-[2px] z-0 bg-gradient-to-br",
                                ['C', 'L', 'R'].includes(player.position) ? 'from-blue-600/50 to-slate-900' :
                                    player.position === 'D' ? 'from-emerald-500/50 to-slate-900' :
                                        'from-amber-400/50 to-slate-900'
                            )}
                            style={{ clipPath: 'polygon(50% 0%, 100% 20%, 100% 85%, 50% 100%, 0% 85%, 0% 20%)' }}
                        />
                        <span className="font-black font-heading text-lg drop-shadow-md mt-[-2px] relative z-10 text-white">
                            {player.position}
                        </span>
                    </div>

                    {/* Injury Badge - Grayscale Effect */}
                    {injury && (
                        <div className="absolute top-3 left-3 z-20">
                            <div className="bg-red-600 text-white px-2 py-1 rounded-sm text-xs font-black uppercase tracking-wider shadow-lg border border-red-400">
                                {injury.status === 'Injured Reserve' ? 'IR' : 'INJ'}
                            </div>
                        </div>
                    )}

                    {/* Player Image - Anchored 25% from top (towards chest), mild zoom */}
                    <div className="relative top-[10px] left-1/2 -translate-x-1/2 w-[220px] h-[220px] overflow-hidden z-10 pointer-events-none">
                        <img
                            src={headshotUrl}
                            alt={player.name}
                            loading="lazy"
                            onError={(e) => {
                                e.currentTarget.src = fallbackHeadshot;
                            }}
                            className="w-full h-full object-cover object-[50%_25%] scale-110 drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)] transition-all duration-300"
                            style={{
                                maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
                                transform: `translateY(${rotateX * -2}px) translateX(${rotateY * -2}px) scale(1.1)` // Parallax + mild zoom
                            }}
                        />
                    </div>
                </div>

                {/* Team Logo - Bottom Left with white glow for dark logos */}
                <div className="absolute bottom-4 left-4 z-30">
                    <img 
                        src={teamLogoUrl} 
                        alt="Team Logo" 
                        className="w-14 h-14 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" 
                    />
                </div>

                {/* Bottom Status Bar - Playing Today indicator */}
                {isPlayingToday ? (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 rounded-b-xl bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                ) : (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl bg-slate-700/50" />
                )}

                {/* Content Section */}
                <div className="flex-1 flex flex-col px-4 pb-3 relative z-20 mt-[-20px]">
                    {/* Name - HUGE Typography */}
                    <div className="text-center w-full mb-3" style={{ transform: 'translateZ(20px)' }}>
                        <h3 className="text-white/70 font-heading font-medium text-sm uppercase tracking-[0.3em] leading-none mb-1 drop-shadow-md">
                            {player.name.split(' ')[0]}
                        </h3>
                        <h2 className="text-white font-heading font-black text-4xl uppercase tracking-wider leading-none drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                            {player.name.split(' ').slice(1).join(' ')}
                        </h2>
                    </div>

                    {/* Stats Pill - Semi-transparent dark blue */}
                    <div className="flex items-center justify-center gap-3 text-xs font-bold tracking-wider text-gray-300 bg-slate-900/70 backdrop-blur-xl py-2 px-5 rounded-full mx-auto w-fit border border-white/10 shadow-lg mb-auto relative overflow-hidden group-hover:bg-slate-800/80 transition-colors">
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
                    <div className="w-full flex items-center justify-end mb-3 mt-auto transition-transform duration-300 group-hover:translate-y-[-2px]">
                        {/* Fantasy Points - Large with Color Coding */}
                        <div className="text-right flex items-baseline gap-2">
                            <div className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">
                                Fantasy Points:
                            </div>
                            <div className={cn("text-5xl font-black leading-none bg-transparent drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]", fpColor.text)}>
                                {fantasyPoints.toFixed(0)}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons - Blue Glowing */}
                    {player.pendingSlot && (
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
                    )}
                </div>
            </div>
        </div>
    );
}
