import { getPlayerFullName, type RosterPerson } from '../../utils/nhlApi';
import { getInjuryIcon } from '../../services/injuryService';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { GradientButton } from '../ui/GradientButton';
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

    // Check if player is a superstar (100+ points)
    const isSuperstar = playerStats && playerStats.points >= 100;
    const isStar = playerStats && playerStats.points >= 80;

    // NHL headshot URL (with fallback)
    const headshotUrl = `https://assets.nhle.com/mugs/nhl/20242025/${teamAbbrev}/${player.person.id}.png`;
    const fallbackHeadshot = "https://assets.nhle.com/mugs/nhl/default-skater.png";
    const teamLogoUrl = `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_dark.svg`;

    const getPositionBadgeVariant = (positionCode: string) => {
        switch (positionCode) {
            case 'C':
            case 'L':
            case 'R':
                return 'info';
            case 'D':
                return 'success';
            case 'G':
                return 'secondary'; // violet
            default:
                return 'default';
        }
    };

    return (
        <GlassCard
            hoverEffect={!isDrafted}
            className={cn(
                "relative flex h-full flex-col p-4 transition-all",
                isDrafted
                    ? "opacity-60 grayscale-[0.5]"
                    : isSuperstar
                        ? "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] bg-gradient-to-br from-slate-900/80 to-amber-900/20"
                        : isStar
                            ? "border-slate-400/40 shadow-[0_0_15px_rgba(148,163,184,0.1)]"
                            : ""
            )}
        >
            {/* Injury Badge - Top Right Corner */}
            {injury && (
                <div
                    className="absolute top-3 right-3 z-20 cursor-help"
                    title={`${injury.status}: ${injury.injuryType} - ${injury.description}`}
                >
                    <Badge variant="danger" className="flex items-center gap-1 shadow-lg">
                        {getInjuryIcon(injury.status)} {
                            injury.status === 'Injured Reserve' ? 'IR' :
                                injury.status === 'Day To Day' ? 'DTD' :
                                    injury.status === 'Out' ? 'OUT' :
                                        injury.status.toUpperCase().substring(0, 3)
                        }
                    </Badge>
                </div>
            )}

            <div className="flex flex-1 flex-col gap-3 overflow-hidden">
                {/* Player Photo & Info */}
                <div className="flex gap-4 items-start">
                    {/* Avatar with Team Logo Badge */}
                    <div className="relative flex-shrink-0 group">
                        <div className={cn(
                            "w-20 h-20 rounded-full p-0.5 bg-gradient-to-br",
                            isSuperstar ? "from-amber-400 to-orange-600" : "from-slate-600 to-slate-800"
                        )}>
                            <img
                                src={headshotUrl}
                                alt={getPlayerFullName(player)}
                                loading="lazy"
                                onError={(e) => {
                                    e.currentTarget.src = fallbackHeadshot;
                                }}
                                className="w-full h-full rounded-full object-cover bg-slate-900"
                            />
                        </div>
                        {/* Team Logo Badge */}
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-slate-900 rounded-full p-0.5 border border-slate-700 shadow-lg">
                            <img
                                src={teamLogoUrl}
                                alt={teamAbbrev}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>

                    {/* Player Details */}
                    <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-slate-400 font-mono text-xs">
                                #{player.jerseyNumber}
                            </span>
                            <Badge variant={getPositionBadgeVariant(player.position.code) as any}>
                                {player.position.code}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                {teamAbbrev}
                            </Badge>
                        </div>
                        <h3 className="text-white font-heading font-bold text-lg leading-tight truncate">
                            {getPlayerFullName(player)}
                        </h3>
                        <p className="text-slate-400 text-xs mb-2">
                            {player.position.name}
                        </p>
                    </div>
                </div>

                {/* Stats Section */}
                <div className="mt-2 mb-4 px-1">
                    {playerStats ? (
                        <div className="grid grid-cols-3 gap-2">
                            {player.position.code === 'G' ? (
                                <>
                                    <div className="col-span-1 bg-slate-800/50 rounded-lg p-2 text-center border border-slate-700/50">
                                        <div className="text-emerald-400 font-black text-xl">{playerStats.wins || 0}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Wins</div>
                                    </div>
                                    <div className="col-span-2 bg-slate-800/50 rounded-lg p-2 flex items-center justify-center gap-3 border border-slate-700/50">
                                        <div className="text-center">
                                            <div className="text-emerald-300 font-bold font-mono">{(playerStats.savePct || 0).toFixed(3)}</div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">SV%</div>
                                        </div>
                                        <div className="w-px h-8 bg-slate-700"></div>
                                        <div className="text-center">
                                            <div className="text-emerald-300 font-bold font-mono">{(playerStats.goalsAgainstAverage || 0).toFixed(2)}</div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">GAA</div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={cn(
                                        "col-span-1 rounded-lg p-2 text-center border",
                                        isSuperstar ? "bg-amber-500/10 border-amber-500/20" : "bg-slate-800/50 border-slate-700/50"
                                    )}>
                                        <div className={cn(
                                            "font-black text-xl",
                                            isSuperstar ? "text-amber-400" : "text-white"
                                        )}>{playerStats.points}</div>
                                        <div className={cn(
                                            "text-[10px] uppercase tracking-wider font-bold",
                                            isSuperstar ? "text-amber-500/70" : "text-slate-500"
                                        )}>Points</div>
                                    </div>
                                    <div className="col-span-1 bg-slate-800/50 rounded-lg p-2 text-center border border-slate-700/50">
                                        <div className="text-slate-200 font-bold text-lg">{playerStats.goals}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Goals</div>
                                    </div>
                                    <div className="col-span-1 bg-slate-800/50 rounded-lg p-2 text-center border border-slate-700/50">
                                        <div className="text-slate-200 font-bold text-lg">{playerStats.assists}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Assists</div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-4 opacity-50">
                            <span className="text-2xl font-black text-slate-600">—</span>
                            <span className="text-[10px] uppercase font-bold text-slate-600">No Data</span>
                        </div>
                    )}
                </div>

                <div className="mt-auto space-y-2">
                    {/* Draft Button */}
                    {draftState && !draftState.isComplete && (
                        <GradientButton
                            onClick={() => onDraft(player)}
                            disabled={isDrafted || isDrafting || !isMyTurn}
                            isLoading={isDrafting && !isDrafted} // Only show loading if not already drafted (edge case)
                            variant={!isMyTurn ? 'outline' : 'primary'}
                            className="w-full"
                        >
                            {isDrafted
                                ? 'Already Drafted'
                                : !isMyTurn
                                    ? 'Not Your Turn'
                                    : 'Draft Player'}
                        </GradientButton>
                    )}

                    {/* Admin: Pick Up Button */}
                    {isAdmin && !isDrafted && (
                        <GradientButton
                            onClick={() => onPickUp(player)}
                            disabled={isDrafting}
                            variant="secondary"
                            size="sm"
                            className="w-full"
                        >
                            {isDrafting ? 'Picking Up...' : '👑 Pick Up (Admin)'}
                        </GradientButton>
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
                        className="w-full py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors border border-transparent hover:border-slate-700"
                    >
                        ⚖️ Compare
                    </button>
                </div>
            </div>
        </GlassCard>
    );
}
