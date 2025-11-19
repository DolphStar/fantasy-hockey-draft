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
        // Tier 1: Legendary / Superstar (Amber/Gold)
        'legendary': {
            card: "bg-gray-800 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] bg-gradient-to-br from-gray-900 via-amber-900/10 to-gray-900",
            foil: "absolute inset-0 opacity-30 bg-[linear-gradient(110deg,transparent_25%,rgba(251,191,36,0.3)_45%,rgba(245,158,11,0.5)_50%,rgba(251,191,36,0.3)_55%,transparent_75%)] bg-[length:250%_100%] animate-shimmer pointer-events-none mix-blend-overlay",
            accentText: "text-amber-400",
            statBorder: "border-amber-500/30",
            avatarRing: "from-amber-400 to-orange-600"
        },
        // Tier 2: Elite (Emerald)
        'elite': {
            card: "bg-gray-800 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
            foil: "",
            accentText: "text-emerald-400",
            statBorder: "border-emerald-500/30",
            avatarRing: "" // No ring
        },
        // Tier 3: Good (Sky Blue)
        'good': {
            card: "bg-gray-800 border-sky-500/50 shadow-[0_0_10px_rgba(14,165,233,0.1)]",
            foil: "",
            accentText: "text-sky-400",
            statBorder: "border-sky-500/30",
            avatarRing: "" // No ring
        },
        // Standard
        'standard': {
            card: "bg-gray-800 border-gray-700/50",
            foil: "",
            accentText: "text-white",
            statBorder: "border-gray-700/50",
            avatarRing: "" // No ring
        }
    };

    // Map specific logic to shared styles
    let styleKey = 'standard';
    if (tier === 'legendary') styleKey = 'legendary';
    else if (tier === 'elite' || tier === 'elite-d' || tier === 'elite-g') styleKey = 'elite';
    else if (tier === 'good' || tier === 'good-d' || tier === 'good-g') styleKey = 'good';

    const currentStyle = styles[styleKey as keyof typeof styles];

    // NHL headshot URL (with fallback)
    const headshotUrl = `https://assets.nhle.com/mugs/nhl/20242025/${teamAbbrev}/${player.person.id}.png`;
    const fallbackHeadshot = "https://assets.nhle.com/mugs/nhl/default-skater.png";
    const teamLogoUrl = `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_dark.svg`;



    return (
        <GlassCard
            hoverEffect={!isDrafted}
            className={cn(
                "relative flex h-full flex-col p-0 transition-all duration-300 overflow-hidden group/card",
                isDrafted
                    ? "opacity-80 grayscale-[0.7] bg-gray-900/50 border-gray-800"
                    : cn(currentStyle.card, "hover:-translate-y-0.5 hover:shadow-xl hover:border-opacity-80")
            )}
        >
            {/* Foil Effect Overlay */}
            {!isDrafted && currentStyle.foil && (
                <div className={currentStyle.foil} />
            )}

            {/* Top Right Badges */}
            <div className="absolute top-2 right-2 z-20 flex flex-col gap-1 items-end">
                {/* Drafted Lock Icon */}
                {isDrafted && (
                    <div className="bg-gray-900/80 p-1.5 rounded-full border border-gray-700 shadow-sm">
                        <span className="text-xs leading-none">🔒</span>
                    </div>
                )}

                {/* Injury Badge */}
                {injury && (
                    <Badge variant="danger" className="shadow-md text-[10px] py-0.5 px-1.5">
                        {getInjuryIcon(injury.status)} {
                            injury.status === 'Injured Reserve' ? 'IR' :
                                injury.status === 'Day To Day' ? 'DTD' :
                                    injury.status === 'Out' ? 'OUT' :
                                        injury.status.toUpperCase().substring(0, 3)
                        }
                    </Badge>
                )}
            </div>

            {/* --- Card Content --- */}
            <div className="flex flex-col h-full">

                {/* 1. Header Section: Headshot & Info */}
                <div className="flex items-center p-3 pb-1 gap-3">
                    {/* Avatar with Overlapping Team Logo */}
                    <div className="relative flex-shrink-0">
                        <div className={cn(
                            "w-14 h-14 rounded-full p-0.5 bg-gradient-to-br relative z-10 shadow-lg",
                            currentStyle.avatarRing
                        )}>
                            <img
                                src={headshotUrl}
                                alt={getPlayerFullName(player)}
                                loading="lazy"
                                onError={(e) => { e.currentTarget.src = fallbackHeadshot; }}
                                className="w-full h-full rounded-full object-cover bg-gray-800"
                            />
                        </div>
                        {/* Team Logo Badge (Overlapping) */}
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-900 rounded-full p-0.5 border border-gray-700 shadow-md flex items-center justify-center z-20">
                            <img
                                src={teamLogoUrl}
                                alt={teamAbbrev}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>

                    {/* Player Name & Position */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className="text-white font-heading font-extrabold text-xl leading-none truncate mb-1 drop-shadow-sm">
                            {getPlayerFullName(player)}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                {teamAbbrev} • {player.position.code}
                            </span>
                            <div className={cn("w-1.5 h-1.5 rounded-full",
                                player.position.code === 'D' ? "bg-green-500" :
                                    player.position.code === 'G' ? "bg-blue-500" : "bg-red-500"
                            )} />
                        </div>
                    </div>
                </div>

                {/* 2. Stat Block (Horizontal) */}
                <div className="px-0 py-1 mt-1 mb-auto">
                    {playerStats ? (
                        <div className="bg-gray-900/30 border-y border-white/5 py-2 px-3 backdrop-blur-sm">
                            {player.position.code === 'G' ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className={cn("text-2xl font-black leading-none filter drop-shadow-sm", currentStyle.accentText)}>
                                            {playerStats.wins || 0}
                                        </span>
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Wins</span>
                                    </div>
                                    <div className="h-6 w-px bg-white/10 mx-2" />
                                    <div className="flex items-center gap-3 text-xs">
                                        <div className="flex flex-col items-end">
                                            <span className="text-gray-200 font-mono font-bold">{(playerStats.savePct || 0).toFixed(3)}</span>
                                            <span className="text-[9px] text-gray-600 uppercase">SV%</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-gray-200 font-mono font-bold">{(playerStats.goalsAgainstAverage || 0).toFixed(2)}</span>
                                            <span className="text-[9px] text-gray-600 uppercase">GAA</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className={cn("text-2xl font-black leading-none filter drop-shadow-sm", currentStyle.accentText)}>
                                            {playerStats.points || 0}
                                        </span>
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Points</span>
                                    </div>
                                    <div className="h-6 w-px bg-white/10 mx-2" />
                                    <div className="flex items-center gap-3 text-xs">
                                        <div className="flex flex-col items-end">
                                            <span className="text-gray-200 font-mono font-bold">{playerStats.goals || 0}</span>
                                            <span className="text-[9px] text-gray-600 uppercase">G</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-gray-200 font-mono font-bold">{playerStats.assists || 0}</span>
                                            <span className="text-[9px] text-gray-600 uppercase">A</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-gray-900/30 border-y border-white/5 py-2 px-3 flex flex-col items-center justify-center">
                            <div className="w-6 h-0.5 bg-gray-700 mb-1 rounded-full" />
                            <span className="text-[9px] text-gray-600 uppercase font-medium">No 23-24 Stats</span>
                        </div>
                    )}
                </div>

                {/* Divider Line */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent my-0.5" />

                {/* 3. Actions Footer */}
                <div className="p-3 pt-1 space-y-1.5">
                    {/* Draft Button */}
                    {draftState && !draftState.isComplete && (
                        <button
                            onClick={() => onDraft(player)}
                            disabled={isDrafted || isDrafting || !isMyTurn}
                            className={cn(
                                "w-full py-1.5 px-3 rounded-md font-bold text-xs transition-all duration-200 shadow-sm border",
                                isDrafted
                                    ? "bg-transparent border-transparent text-gray-600 cursor-not-allowed hidden" // Hide if drafted
                                    : !isMyTurn
                                        ? "bg-transparent border-gray-700/30 text-gray-600 cursor-not-allowed font-medium"
                                        : "bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-500/50 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/20 hover:shadow-blue-900/40 hover:-translate-y-0.5"
                            )}
                        >
                            {isDrafted
                                ? 'Drafted'
                                : !isMyTurn
                                    ? 'Not Your Turn'
                                    : isDrafting ? 'Drafting...' : 'Draft Player'}
                        </button>
                    )}

                    {/* Admin Pick Up - Only show if NOT drafted */}
                    {isAdmin && !isDrafted && (
                        <button
                            onClick={() => onPickUp(player)}
                            disabled={isDrafting}
                            className="w-full py-1 px-2 rounded bg-violet-900/20 hover:bg-violet-600 border border-violet-500/30 hover:border-violet-500 text-violet-300 hover:text-white text-[10px] font-bold transition-all uppercase tracking-wide"
                        >
                            {isDrafting ? '...' : '👑 Pick Up'}
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
                        className="w-full py-1 text-[10px] font-medium text-gray-500 hover:text-white hover:bg-white/5 rounded transition-colors flex items-center justify-center gap-1"
                    >
                        <span>⚖️</span> Compare
                    </button>
                </div>
            </div>
        </GlassCard>
    );
}
