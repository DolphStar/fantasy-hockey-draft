import { getInjuryIcon } from '../../services/injuryService';
import { cn } from '../../lib/utils';
import PlayerSparkline from './PlayerSparkline';

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
    isSwapMode?: boolean;
    isSelected?: boolean;
}

export default function MyPlayerCard({
    player,
    fantasyPoints = 0,
    stats = { goals: 0, assists: 0, gamesPlayed: 0, avgPoints: 0 },
    history = [],
    injury,
    onSwap,
    onCancelSwap,
    isSwapMode,
    isSelected,
}: MyPlayerCardProps) {
    const teamAbbrev = player.nhlTeam || 'UNK';
    const headshotUrl = `https://assets.nhle.com/mugs/nhl/20242025/${teamAbbrev}/${player.playerId}.png`;
    const fallbackHeadshot = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
    const theme = getPositionTheme(player.position);
    const isSpecial = !!injury || player.rosterSlot === 'reserve';

    // Calculate running average for graph
    const avgHistory = history.length > 0 ? history.map((_, idx) => {
        const subset = history.slice(0, idx + 1);
        const sum = subset.reduce((acc, curr) => acc + (curr.points || 0), 0);
        const avg = subset.length > 0 ? sum / subset.length : 0;
        return { points: isNaN(avg) ? 0 : avg };
    }) : [];

    return (
        <div
            className={cn(
                'relative group transition-all duration-300 h-[360px] w-full',
                isSelected ? 'scale-[1.02] z-10' : 'hover:scale-[1.01]'
            )}
        >
            {/* Main Card Container */}
            <div
                className={cn(
                    'h-full w-full rounded-2xl overflow-visible relative flex flex-col',
                    'bg-slate-900/40 backdrop-blur-md border-2 transition-all duration-300',
                    isSelected
                        ? 'border-white shadow-[0_0_30px_rgba(255,255,255,0.4)]'
                        : 'border-white/30 hover:border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.1)] hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                )}
            >
                {/* Top Section: Image and Badges */}
                <div className="relative h-48 w-full overflow-visible shrink-0">
                    {/* Position Badge */}
                    <div
                        className={cn(
                            'absolute top-3 right-3 z-20 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm border-2',
                            `bg-${theme.color} border-white/20 text-white`
                        )}
                    >
                        <span className="font-black font-heading text-lg drop-shadow-md">
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

                    {/* Player Image */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full flex items-start justify-center z-10 pt-2">
                        <img
                            src={headshotUrl}
                            alt={player.name}
                            loading="lazy"
                            onError={(e) => {
                                e.currentTarget.src = fallbackHeadshot;
                            }}
                            className="w-56 h-56 object-cover object-top drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]"
                            style={{
                                maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
                            }}
                        />
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 flex flex-col px-5 pb-4 relative z-20">
                    {/* Name */}
                    <div className="text-center w-full mb-3 py-2">
                        <h3 className="text-gray-400 font-heading font-normal text-xs uppercase tracking-wide leading-none mb-0.5">
                            {player.name.split(' ')[0]}
                        </h3>
                        <h2 className="text-white font-heading font-black text-2xl uppercase tracking-[0.15em] leading-none mb-2">
                            {player.name.split(' ').slice(1).join(' ')}
                        </h2>

                        {/* Stats G/A/AVG */}
                        <div className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-wider text-gray-400 bg-white/5 py-1 px-3 rounded-full mx-auto w-fit border border-white/10">
                            <span className="flex items-center gap-1">
                                <span className="text-gray-500">G:</span>
                                <span className="text-white">{stats?.goals ?? 0}</span>
                            </span>
                            <span className="w-px h-3 bg-gray-700" />
                            <span className="flex items-center gap-1">
                                <span className="text-gray-500">A:</span>
                                <span className="text-white">{stats?.assists ?? 0}</span>
                            </span>
                            <span className="w-px h-3 bg-gray-700" />
                            <span className="flex items-center gap-1">
                                <span className="text-gray-500">AVG:</span>
                                <span className="text-white">{stats?.avgPoints?.toFixed(1) ?? '0.0'}</span>
                            </span>
                        </div>
                    </div>

                    {/* Stats Area */}
                    <div className="w-full flex items-center justify-between mb-3 mt-auto">
                        {/* Line Graph - Running Average */}
                        <div className="h-10 w-20 relative opacity-90">
                            {avgHistory.length > 0 ? (
                                <PlayerSparkline data={avgHistory} color={theme.graph} />
                            ) : (
                                <div className="w-full h-full border-b border-gray-600 flex items-end">
                                    <span className="text-[8px] text-gray-500">No data</span>
                                </div>
                            )}
                        </div>

                        {/* Fantasy Points */}
                        <div className="text-right flex items-baseline gap-2">
                            <div className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">
                                Fantasy Points:
                            </div>
                            <div className="text-4xl font-black text-white leading-none">
                                {fantasyPoints.toFixed(0)}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {player.pendingSlot ? (
                        <div className="w-full mt-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCancelSwap?.(player);
                                }}
                                className="w-full py-1 rounded-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 text-[10px] font-bold uppercase tracking-wider text-center hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-200 transition-all cursor-pointer"
                            >
                                Pending Swap (Cancel?)
                            </button>
                        </div>
                    ) : (
                        <div className="w-full mt-2 transition-opacity duration-300">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSwap?.(player);
                                }}
                                className={cn(
                                    'w-full py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all',
                                    isSelected
                                        ? 'bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500/30'
                                        : 'bg-blue-500/20 border border-blue-500/50 text-blue-200 hover:bg-blue-500/30'
                                )}
                            >
                                {isSelected ? 'Cancel Swap' : 'Swap Player'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
