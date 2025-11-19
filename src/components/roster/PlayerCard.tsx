import { getPlayerFullName, type RosterPerson } from '../../utils/nhlApi';
import { getInjuryIcon } from '../../services/injuryService';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';

import { cn } from '../../lib/utils';
import { useComparison } from '../../context/ComparisonContext';

interface PlayerCardProps {
    player: RosterPerson;
    isDrafted: boolean;
    isDrafting: boolean;
    isMyTurn: boolean;
    isAdmin: boolean;
    onDraft: (player: RosterPerson) => void;
    onPickUp: (player: RosterPerson) => void;
    playerStats: any;
    injury: any;
    draftState: any;
}

export default function PlayerCard({
    player,
    isDrafted,
    isDrafting,
    isMyTurn,
    isAdmin,
    onDraft,
    onPickUp,
    playerStats,
    injury,
    draftState
}: PlayerCardProps) {
    const { addPlayerToCompare } = useComparison();
    const teamAbbrev = (player as any).teamAbbrev || 'UNK';

    // --- 1. Rarity & Tier Logic ---
    const getCardTier = () => {
        if (!playerStats) return 'standard';

        const pos = player.position.code;
        const points = playerStats.points || 0;
        const wins = playerStats.wins || 0;
        const svPct = playerStats.savePct || 0;

        // Forward (C, L, R)
        if (['C', 'L', 'R'].includes(pos)) {
            if (points >= 100) return 'legendary';
            if (points >= 70) return 'elite';
            if (points >= 40) return 'good';
            return 'standard';
        }

        // Defenseman (D)
        if (pos === 'D') {
            if (points >= 50) return 'elite-d';
            if (points >= 30) return 'good-d';
            return 'standard-d';
        }

        // Goalie (G)
        if (pos === 'G') {
            if (wins >= 30 || svPct > 0.915) return 'elite-g';
            if ((wins >= 15 && wins < 30) || (svPct >= 0.900 && svPct <= 0.915)) return 'good-g';
            return 'standard-g';
        }

        return 'standard';
    };

    const tier = getCardTier();

    // --- 2. Style Configuration ---
    const styles = {
        // Skaters
        'legendary': {
            card: "bg-gray-800 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] bg-gradient-to-br from-gray-900 via-amber-900/10 to-gray-900",
            foil: "absolute inset-0 opacity-30 bg-[linear-gradient(110deg,transparent_25%,rgba(251,191,36,0.3)_45%,rgba(245,158,11,0.5)_50%,rgba(251,191,36,0.3)_55%,transparent_75%)] bg-[length:250%_100%] animate-shimmer pointer-events-none mix-blend-overlay",
            accentText: "text-amber-400",
            statBorder: "border-amber-500/30"
        },
        'elite': {
            card: "bg-gray-800 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
            foil: "",
            accentText: "text-emerald-400",
            statBorder: "border-emerald-500/30"
        },
        'good': {
            card: "bg-gray-800 border-sky-500/50 shadow-[0_0_10px_rgba(14,165,233,0.1)]",
            foil: "",
            accentText: "text-sky-400",
            statBorder: "border-sky-500/30"
        },
        'standard': {
            card: "bg-gray-800 border-gray-700/50",
            foil: "",
            accentText: "text-white",
            statBorder: "border-gray-700/50"
        },
        // Defensemen
        'elite-d': {
            card: "bg-gray-800 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]",
            foil: "",
            accentText: "text-purple-400",
            statBorder: "border-purple-500/30"
        },
        'good-d': {
            card: "bg-gray-800 border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.1)]",
            foil: "",
            accentText: "text-pink-400",
            statBorder: "border-pink-500/30"
        },
        'standard-d': {
            card: "bg-gray-800 border-gray-700/50",
            foil: "",
            accentText: "text-white",
            statBorder: "border-gray-700/50"
        },
        // Goalies
        'elite-g': {
            card: "bg-gray-800 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]",
            foil: "",
            accentText: "text-cyan-400",
            statBorder: "border-cyan-500/30"
        },
        'good-g': {
            card: "bg-gray-800 border-lime-500/50 shadow-[0_0_10px_rgba(132,204,22,0.1)]",
            foil: "",
            accentText: "text-lime-400",
            statBorder: "border-lime-500/30"
        },
        'standard-g': {
            card: "bg-gray-800 border-gray-700/50",
            foil: "",
            accentText: "text-white",
            statBorder: "border-gray-700/50"
        }
    };

    const currentStyle = styles[tier];

    // NHL headshot URL (with fallback)
    const headshotUrl = `https://assets.nhle.com/mugs/nhl/20242025/${teamAbbrev}/${player.person.id}.png`;
    const fallbackHeadshot = "https://assets.nhle.com/mugs/nhl/default-skater.png";
    const teamLogoUrl = `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_dark.svg`;

    // Position Badge Variant
    const getPositionBadgeVariant = (positionCode: string) => {
        switch (positionCode) {
            case 'C':
            case 'L':
            case 'R':
                return 'solid-red';
            case 'D':
                return 'solid-green';
            case 'G':
                return 'solid-blue';
            default:
                return 'default';
        }
    };

    return (
        <GlassCard
            hoverEffect={!isDrafted}
            className={cn(
                "relative flex h-full flex-col p-0 transition-all overflow-hidden group/card",
                isDrafted ? "opacity-60 grayscale-[0.5] bg-gray-800/50 border-gray-700" : currentStyle.card
            )}
        >
            {/* Foil Effect Overlay */}
            {!isDrafted && currentStyle.foil && (
                <div className={currentStyle.foil} />
            )}

            {/* Top Right Badges (IR/OUT) */}
            {injury && (
                <div className="absolute top-2 right-2 z-20">
                    <Badge variant="danger" className="shadow-md">
                        {getInjuryIcon(injury.status)} {
                            injury.status === 'Injured Reserve' ? 'IR' :
                                injury.status === 'Day To Day' ? 'DTD' :
                                    injury.status === 'Out' ? 'OUT' :
                                        injury.status.toUpperCase().substring(0, 3)
                        }
                    </Badge>
                </div>
            )}

            {/* --- Card Content --- */}
            <div className="flex flex-col h-full">

                {/* 1. Header Section: Headshot & Info */}
                <div className="flex items-center p-4 pb-2 gap-4">
                    {/* Avatar with Overlapping Team Logo */}
                    <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden border-2 border-gray-600">
                            <img
                                src={headshotUrl}
                                alt={getPlayerFullName(player)}
                                loading="lazy"
                                onError={(e) => { e.currentTarget.src = fallbackHeadshot; }}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Team Logo Badge (Overlapping) */}
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gray-800 rounded-full p-0.5 border border-gray-600 shadow-md flex items-center justify-center">
                            <img
                                src={teamLogoUrl}
                                alt={teamAbbrev}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>

                    {/* Player Name & Position */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant={getPositionBadgeVariant(player.position.code) as any}>
                                {player.position.code}
                            </Badge>
                            <span className="text-gray-400 text-xs font-medium tracking-wider">
                                {teamAbbrev}
                            </span>
                        </div>
                        <h3 className="text-white font-heading font-bold text-lg leading-tight truncate">
                            {getPlayerFullName(player)}
                        </h3>
                        <p className="text-gray-500 text-xs">
                            {player.position.name}
                        </p>
                    </div>
                </div>

                {/* 2. Stat Block (Horizontal) */}
                <div className="px-0 py-2 mt-1 mb-auto">
                    {playerStats ? (
                        <div className="bg-gray-900/40 border-y border-gray-700/50 py-2 px-4">
                            {player.position.code === 'G' ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className={cn("text-2xl font-black leading-none", currentStyle.accentText)}>
                                            {playerStats.wins || 0}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Wins</span>
                                    </div>
                                    <div className="h-8 w-px bg-gray-700/50 mx-4" />
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex flex-col items-end">
                                            <span className="text-gray-100 font-mono font-bold">{(playerStats.savePct || 0).toFixed(3)}</span>
                                            <span className="text-[10px] text-gray-500 uppercase">SV%</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-gray-100 font-mono font-bold">{(playerStats.goalsAgainstAverage || 0).toFixed(2)}</span>
                                            <span className="text-[10px] text-gray-500 uppercase">GAA</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className={cn("text-2xl font-black leading-none", currentStyle.accentText)}>
                                            {playerStats.points || 0}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Points</span>
                                    </div>
                                    <div className="h-8 w-px bg-gray-700/50 mx-4" />
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex flex-col items-end">
                                            <span className="text-gray-100 font-mono font-bold">{playerStats.goals || 0}</span>
                                            <span className="text-[10px] text-gray-500 uppercase">G</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-gray-100 font-mono font-bold">{playerStats.assists || 0}</span>
                                            <span className="text-[10px] text-gray-500 uppercase">A</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-gray-900/40 border-y border-gray-700/50 py-3 px-4 flex flex-col items-center justify-center">
                            <div className="w-8 h-0.5 bg-gray-600 mb-1 rounded-full" />
                            <span className="text-[10px] text-gray-500 uppercase font-medium">No 23-24 Stats</span>
                        </div>
                    )}
                </div>

                {/* 3. Actions Footer */}
                <div className="p-4 pt-2 space-y-2">
                    {/* Draft Button */}
                    {draftState && !draftState.isComplete && (
                        <button
                            onClick={() => onDraft(player)}
                            disabled={isDrafted || isDrafting || !isMyTurn}
                            className={cn(
                                "w-full py-2 px-4 rounded-lg font-bold text-sm transition-all duration-200 shadow-sm",
                                isDrafted
                                    ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                                    : !isMyTurn
                                        ? "bg-gray-800 border border-gray-700 text-gray-500 hover:bg-gray-700 hover:text-gray-400"
                                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/20"
                            )}
                        >
                            {isDrafted
                                ? 'Already Drafted'
                                : !isMyTurn
                                    ? 'Not Your Turn'
                                    : isDrafting && !isDrafted ? 'Drafting...' : 'Draft Player'}
                        </button>
                    )}

                    {/* Admin Pick Up */}
                    {isAdmin && !isDrafted && (
                        <button
                            onClick={() => onPickUp(player)}
                            disabled={isDrafting}
                            className="w-full py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors shadow-sm"
                        >
                            {isDrafting ? 'Picking Up...' : '👑 Pick Up (Admin)'}
                        </button>
                    )}

                    {/* Compare Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            addPlayerToCompare({
                                id: player.person.id,
                                name: getPlayerFullName(player),
                                headshot: headshotUrl,
                                positionCode: player.position.code,
                                teamAbbrev: teamAbbrev,
                                stats: playerStats
                            });
                        }}
                        className="w-full py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    >
                        ⚖️ Compare
                    </button>
                </div>
            </div>
        </GlassCard>
    );
}
