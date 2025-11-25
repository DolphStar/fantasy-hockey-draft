import { useState } from 'react';
import { getPlayerFullName, type RosterPerson } from '../../utils/nhlApi';
import { cn } from '../../lib/utils';
import { useComparison } from '../../context/ComparisonContext';
import { PlayerPositionBadge } from './PlayerPositionBadge';
import { PlayerStatsPill } from './PlayerStatsPill';

interface PlayerCardProps {
    player: RosterPerson;
    isDrafted: boolean;
    isDrafting: boolean;
    isMyTurn: boolean;
    onDraft: (player: RosterPerson) => void;
    playerStats: any;
    injury: any;
    draftState: any;
}

export default function PlayerCard({
    player,
    isDrafted,
    isDrafting,
    isMyTurn,
    onDraft,
    playerStats,
    injury,
    draftState
}: PlayerCardProps) {
    const { addPlayerToCompare } = useComparison();
    const teamAbbrev = (player as any).teamAbbrev || 'UNK';
    const position = player.position.code;
    const isForward = ['C', 'L', 'R'].includes(position);

    const headshotUrl = `https://assets.nhle.com/mugs/nhl/20242025/${teamAbbrev}/${player.person.id}.png`;
    const fallbackHeadshot = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
    const teamLogoUrl = `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_light.svg`;

    const goals = playerStats?.goals;
    const assists = playerStats?.assists;
    const avgPoints = typeof playerStats?.pointsPerGame === 'number'
        ? playerStats.pointsPerGame
        : typeof playerStats?.points === 'number'
            ? Number((playerStats.points / 82).toFixed(1))
            : undefined;

    // Calculate last season fantasy points
    // Skaters: 1pt per goal, 1pt per assist
    // Goalies: 2pts per win
    const lastSeasonFantasyPoints = isForward || position === 'D'
        ? (playerStats?.goals || 0) + (playerStats?.assists || 0)
        : (playerStats?.wins || 0) * 2;

    // Color coding based on fantasy points
    // Skaters: 100+ = gold, 60-99 = green, 30-59 = blue, <30 = white
    // Goalies: 70+ = gold (lower threshold since wins*2 caps lower)
    const isGoalie = position === 'G';
    const getFantasyPointsColor = (points: number) => {
        const exceptionalThreshold = isGoalie ? 70 : 100;
        const goodThreshold = isGoalie ? 50 : 60;
        const normalThreshold = isGoalie ? 25 : 30;
        
        if (points >= exceptionalThreshold) return { text: 'text-amber-400', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]', border: 'border-amber-400/70' };
        if (points >= goodThreshold) return { text: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.4)]', border: 'border-emerald-400/50' };
        if (points >= normalThreshold) return { text: 'text-blue-400', glow: 'shadow-[0_0_10px_rgba(96,165,250,0.3)]', border: 'border-blue-400/50' };
        return { text: 'text-white', glow: '', border: '' };
    };

    const fpColor = getFantasyPointsColor(lastSeasonFantasyPoints);
    const isExceptional = lastSeasonFantasyPoints >= (isGoalie ? 70 : 100);

    const statDisplay = (value: number | undefined | null, formatter: (val: number) => string = (val) => val.toString()) => {
        if (value === undefined || value === null || Number.isNaN(value)) return 'N/A';
        return formatter(value);
    };

    const draftStatusLabel = !draftState || draftState.isComplete
        ? null
        : isDrafted
            ? 'Already Drafted'
            : !isMyTurn
                ? 'Not your turn'
                : null;

    // 3D Tilt Effect State
    const [rotateX, setRotateX] = useState(0);
    const [rotateY, setRotateY] = useState(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const card = e.currentTarget;
        const box = card.getBoundingClientRect();
        const x = e.clientX - box.left;
        const y = e.clientY - box.top;
        const centerX = box.width / 2;
        const centerY = box.height / 2;
        const rotateXVal = (y - centerY) / 25;
        const rotateYVal = (centerX - x) / 25;

        setRotateX(rotateXVal);
        setRotateY(rotateYVal);
    };

    const handleMouseLeave = () => {
        setRotateX(0);
        setRotateY(0);
    };

    return (
        <div
            className="relative group transition-all duration-300 h-[420px] w-full perspective-1000 cursor-pointer"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
                transition: 'transform 0.1s ease-out'
            }}
        >
            <div
                className={cn(
                    'h-full w-full rounded-2xl overflow-visible relative flex flex-col',
                    'border-2 transition-all duration-300 bg-slate-900',
                    'hover:-translate-y-1',
                    isDrafted
                        ? 'border-slate-700/60 opacity-80 grayscale-[0.35]'
                        : isExceptional
                            ? 'border-amber-400/70 shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:shadow-[0_0_40px_rgba(251,191,36,0.6)]'
                            : 'border-slate-700/50 hover:border-blue-400/70 shadow-xl hover:shadow-lg hover:shadow-blue-500/20'
                )}
                style={{ background: '#0f172a' }}
            >
                {/* Noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none z-0 mix-blend-overlay rounded-xl"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
                />

                {/* Team Logo Blend */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-0 mix-blend-overlay overflow-hidden rounded-xl">
                    <img src={teamLogoUrl} alt="Team Logo" className="w-full h-full object-contain scale-[1.85]" />
                </div>

                <div className="relative h-64 w-full overflow-visible shrink-0">
                    <PlayerPositionBadge position={position} />

                    {/* Injury Badge with Tooltip */}
                    {injury && (
                        <div className="absolute top-3 left-3 z-20 group/injury">
                            <div className="bg-red-600 text-white px-2 py-1 rounded-sm text-xs font-black uppercase tracking-wider shadow-lg border border-red-400 cursor-help">
                                {injury.status === 'Injured Reserve' ? 'IR' : 'INJ'}
                            </div>
                            {/* Tooltip */}
                            <div className="absolute left-0 top-full mt-2 w-48 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl opacity-0 invisible group-hover/injury:opacity-100 group-hover/injury:visible transition-all duration-200 z-50">
                                <p className="text-white text-xs font-semibold mb-1">{injury.status}</p>
                                {injury.description && (
                                    <p className="text-gray-400 text-xs">{injury.description}</p>
                                )}
                                {injury.date && (
                                    <p className="text-gray-500 text-[10px] mt-1">Since: {injury.date}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Player Image */}
                    <div className="relative top-[10px] left-1/2 -translate-x-1/2 w-[220px] h-[220px] overflow-hidden z-10 pointer-events-none">
                        <img
                            src={headshotUrl}
                            alt={getPlayerFullName(player)}
                            loading="lazy"
                            onError={(e) => {
                                e.currentTarget.src = fallbackHeadshot;
                            }}
                            className="w-full h-full object-cover object-[50%_25%] scale-110 drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)] transition-all duration-300"
                            style={{
                                maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)'
                            }}
                        />
                    </div>
                </div>

                {/* Team Logo bottom-left */}
                <div className="absolute bottom-4 left-4 z-30">
                    <img
                        src={teamLogoUrl}
                        alt="Team Logo"
                        className="w-14 h-14 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                    />
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col px-4 pb-3 relative z-20 mt-[-20px]">
                    <div className="text-center w-full mb-3">
                        <h3 className="text-white/70 font-heading font-medium text-sm uppercase tracking-[0.3em] leading-none mb-1 drop-shadow-md">
                            {player.person.firstName.default}
                        </h3>
                        <h2 className="text-white font-heading font-black text-4xl uppercase tracking-wider leading-none drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                            {player.person.lastName.default}
                        </h2>
                    </div>

                    <PlayerStatsPill
                        goals={statDisplay(isForward || position === 'D' ? goals : playerStats?.wins, (val) => `${val}`)}
                        assists={statDisplay(
                            isForward || position === 'D'
                                ? assists
                                : playerStats?.savePct
                                    ? Number((playerStats.savePct * 100).toFixed(1))
                                    : undefined,
                            (val) => (isForward || position === 'D') ? `${val}` : `${val}%`
                        )}
                        avg={statDisplay(
                            isForward || position === 'D'
                                ? avgPoints
                                : (playerStats?.goalsAgainstAverage ?? undefined),
                            (val) => (isForward || position === 'D') ? Number(val).toFixed(1) : Number(val).toFixed(2)
                        )}
                        goalsLabel={isForward || position === 'D' ? 'G' : 'W'}
                        assistsLabel={isForward || position === 'D' ? 'A' : 'SV%'}
                        avgLabel={isForward || position === 'D' ? 'AVG' : 'GAA'}
                    />

                    {/* Actions */}
                    <div className="mt-4 space-y-2">
                        {draftStatusLabel && (
                            <div className="text-center text-xs text-slate-400 font-semibold py-1.5 border border-slate-700/60 rounded-full">
                                {draftStatusLabel}
                            </div>
                        )}

                        {!draftStatusLabel && draftState && !draftState.isComplete && (
                            <button
                                onClick={() => onDraft(player)}
                                disabled={isDrafting}
                                className="w-full py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold tracking-wide shadow-[0_5px_15px_rgba(37,99,235,0.35)] hover:shadow-[0_8px_20px_rgba(37,99,235,0.5)] transition-all disabled:cursor-not-allowed"
                            >
                                {isDrafting ? 'Drafting…' : 'Draft Player'}
                            </button>
                        )}

                    </div>
                </div>

                {/* Fantasy Points - Bottom Right */}
                {playerStats && lastSeasonFantasyPoints > 0 && (
                    <div className="absolute bottom-3 right-3 z-30 text-right">
                        <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
                            Last Season:
                        </div>
                        <div className={cn(
                            "text-4xl font-black leading-none",
                            fpColor.text,
                            isExceptional && "drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]"
                        )}>
                            {lastSeasonFantasyPoints}
                        </div>
                    </div>
                )}

                {/* Compare button - absolute bottom center */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        addPlayerToCompare({
                            id: player.person.id,
                            name: getPlayerFullName(player),
                            headshot: headshotUrl,
                            positionCode: player.position.code,
                            teamAbbrev,
                            stats: playerStats
                        });
                    }}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full border border-slate-700/60 text-xs font-semibold text-gray-400 hover:text-white hover:border-slate-400 transition-colors z-30"
                >
                    ⚖️ Compare
                </button>
            </div>
        </div>
    );
}
