import { cn } from '../../lib/utils';
import { useCountUp } from '../../hooks/useCountUp';

import PlayerGameLogPopup from './PlayerGameLogPopup';
import { useEffect, useRef, useState } from 'react';
import { PlayerPositionBadge } from './PlayerPositionBadge';
import { PlayerStatsPill } from './PlayerStatsPill';
import type { DraftedPlayer } from '../../types/draftedPlayer';

const POPUP_HOVER_DELAY_MS = 400;

interface MyPlayerCardProps {
    player: DraftedPlayer;
    fantasyPoints?: number;
    stats?: { goals: number; assists: number; gamesPlayed: number; avgPoints: number };
    history?: { points: number; date?: string }[];
    injury?: { status: string };
    isPlayingToday?: boolean;
    // Swap props
    onSwap?: (player: any) => void;
    onCancelSwap?: (player: any) => void;
    isSelected?: boolean;
    isOverlay?: boolean;
    /** Swap mode is armed somewhere on the page (suppresses the hover popup). */
    swapModeActive?: boolean;
    /** This card is a legal target for the armed swap. */
    swapEligible?: boolean;
    /** This card cannot take part in the armed swap. */
    swapDimmed?: boolean;
    /** Name of the pending-swap counterpart, for the pending strip. */
    pendingSwapWithName?: string;
    /** Short label for when pending swaps apply, e.g. "Sat 5 AM". */
    swapLockLabel?: string;
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
    swapModeActive = false,
    swapEligible = false,
    swapDimmed = false,
    pendingSwapWithName,
    swapLockLabel,
}: MyPlayerCardProps) {
    const [showPopup, setShowPopup] = useState(false);
    const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const schedulePopup = () => {
        if (isOverlay || swapModeActive) return;
        if (popupTimer.current) clearTimeout(popupTimer.current);
        popupTimer.current = setTimeout(() => setShowPopup(true), POPUP_HOVER_DELAY_MS);
    };

    const dismissPopup = (afterMs = 0) => {
        if (popupTimer.current) clearTimeout(popupTimer.current);
        if (afterMs > 0) {
            popupTimer.current = setTimeout(() => setShowPopup(false), afterMs);
        } else {
            setShowPopup(false);
        }
    };

    useEffect(() => () => {
        if (popupTimer.current) clearTimeout(popupTimer.current);
    }, []);

    // Swap mode arming anywhere on the page hides an already-open popup
    useEffect(() => {
        if (swapModeActive) setShowPopup(false);
    }, [swapModeActive]);
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

    // Color coding based on season fantasy points (tiered exception to the points-green color role)
    // Skaters: 100+ = gold, 60-99 = green, 30-59 = blue, <30 = gray
    // Goalies: 70+ = gold (lower thresholds since their scoring caps lower)
    const isGoalie = player.position === 'G';
    const getFpColor = (fp: number) => {
        const exceptionalThreshold = isGoalie ? 70 : 100;
        const goodThreshold = isGoalie ? 50 : 60;
        const normalThreshold = isGoalie ? 25 : 30;

        if (fp >= exceptionalThreshold) return { text: 'text-amber-400', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]' };
        if (fp >= goodThreshold) return { text: 'text-emerald-400', glow: 'shadow-[0_0_20px_rgba(74,222,128,0.6)]' };
        if (fp >= normalThreshold) return { text: 'text-blue-400', glow: 'shadow-[0_0_20px_rgba(96,165,250,0.6)]' };
        return { text: 'text-gray-400', glow: 'shadow-[0_0_10px_rgba(156,163,175,0.4)]' };
    };

    const fpColor = getFpColor(fantasyPoints);
    const animatedFp = useCountUp(fantasyPoints, 0, 'my-roster-points');

    // Edge light tinted by position (G gold, D emerald, forwards blue)
    const positionEdge = player.position === 'G'
        ? 'border-amber-400/30 hover:border-amber-400/60'
        : player.position === 'D'
            ? 'border-emerald-400/30 hover:border-emerald-400/60'
            : 'border-blue-400/30 hover:border-blue-400/60';



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
        dismissPopup();
    };

    // Holographic Foil for Top Players (e.g., > 15 FP or specific rank)
    const isTopPlayer = fantasyPoints >= 15;

    return (
        <div
            className={cn(
                'relative group transition-all duration-300 h-[420px] w-full perspective-1000',
                isSelected ? 'z-10' : 'hover:z-20',
                (onSwap || isSelected) && 'cursor-pointer',
                swapDimmed && 'opacity-40 saturate-50'
            )}
            onClick={(e) => {
                e.stopPropagation();
                onSwap?.(player);
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseEnter={schedulePopup}
            onTouchStart={schedulePopup}
            onTouchEnd={() => dismissPopup(3000)}
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
                    'border-2 transition-all duration-300 bg-gradient-to-br from-[#1e293b] to-[#0d1322] shadow-glass',
                    'hover:-translate-y-1',
                    isSelected
                        ? 'border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.6),0_0_60px_rgba(251,191,36,0.3)]'
                        : swapEligible
                            ? 'border-blue-400/90 shadow-[0_0_22px_rgba(96,165,250,0.4)] hover:shadow-[0_0_32px_rgba(96,165,250,0.6)]'
                            : cn(positionEdge, 'hover:shadow-glass-hover')
                )}
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
                    <PlayerPositionBadge position={player.position} />

                    {/* Injury Badge - Grayscale Effect */}
                    {injury && (
                        <div className="absolute top-3 left-3 z-20">
                            <div className="bg-red-600 text-white px-2 py-1 rounded-sm text-xs font-black uppercase tracking-wider shadow-lg border border-red-400 animate-live-pulse motion-reduce:animate-none">
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

                    <PlayerStatsPill
                        goals={stats?.goals ?? 0}
                        assists={stats?.assists ?? 0}
                        avg={(stats?.avgPoints ?? 0).toFixed(1)}
                        avgClassName={getAvgColor(stats?.avgPoints ?? 0)}
                    />

                    {/* Stats Area */}
                    <div className="w-full flex items-center justify-end mb-3 mt-auto transition-transform duration-300 group-hover:translate-y-[-2px]">
                        {/* Fantasy Points - Large with Color Coding */}
                        <div className="text-right flex items-baseline gap-2">
                            <div className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">
                                Fantasy Points:
                            </div>
                            <div className={cn("text-5xl font-black leading-none bg-transparent drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] tabular-nums", fpColor.text)}>
                                {animatedFp}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Pending swap strip — sits inside the card so it never collides with the grid */}
                {player.pendingSlot && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancelSwap?.(player);
                        }}
                        title="Cancel this swap"
                        className={cn(
                            'absolute bottom-0 inset-x-0 z-40 rounded-b-[14px]',
                            'flex items-center justify-between gap-2 px-4 py-2',
                            'bg-gradient-to-b from-amber-400 to-amber-600 text-slate-900',
                            'shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]',
                            'transition-all duration-200 hover:brightness-110 group/pending'
                        )}
                    >
                        <span className="flex flex-col items-start leading-tight text-left">
                            <span className="text-[11px] font-black uppercase tracking-[0.15em]">
                                {player.pendingSlot === 'reserve' ? '↓ Moving to Reserve' : '↑ Moving to Active'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-900/80">
                                {pendingSwapWithName ? `with ${pendingSwapWithName}` : 'pending swap'}
                                {swapLockLabel ? ` · ${swapLockLabel}` : ''}
                            </span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider opacity-0 group-hover/pending:opacity-100 transition-opacity whitespace-nowrap">
                            ✕ Cancel
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
