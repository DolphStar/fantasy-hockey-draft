import { cn } from '../../lib/utils';

interface PlayerListRowProps {
    player: {
        id: string;
        playerId: string;
        name: string;
        position: string;
        nhlTeam: string;
        jerseyNumber: number;
        rosterSlot: 'active' | 'reserve';
        pendingSlot?: 'active' | 'reserve' | null;
    };
    fantasyPoints?: number;
    stats?: { goals: number; assists: number; gamesPlayed: number; avgPoints: number };
    injury?: { status: string };
    onSwap?: (player: any) => void;
    onCancelSwap?: (player: any) => void;
    isSelected?: boolean;
}

export default function PlayerListRow({
    player,
    fantasyPoints = 0,
    stats = { goals: 0, assists: 0, gamesPlayed: 0, avgPoints: 0 },
    injury,
    onSwap,
    onCancelSwap,
    isSelected
}: PlayerListRowProps) {
    const teamAbbrev = player.nhlTeam || 'UNK';
    const headshotUrl = `https://assets.nhle.com/mugs/nhl/20242025/${teamAbbrev}/${player.playerId}.png`;
    const fallbackHeadshot = 'https://assets.nhle.com/mugs/nhl/default-skater.png';

    // Color-code AVG based on performance
    const getAvgColor = (avg: number) => {
        if (avg >= 2.0) return 'text-cyan-400';
        if (avg >= 1.0) return 'text-blue-400';
        if (avg >= 0.5) return 'text-blue-300';
        return 'text-slate-400';
    };

    return (
        <div
            className={cn(
                "group relative flex items-center gap-4 p-3 rounded-xl transition-all duration-200 border",
                isSelected
                    ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                    : "bg-slate-800/40 border-white/5 hover:bg-slate-800/60 hover:border-white/10",
                (onSwap || isSelected) && "cursor-pointer"
            )}
            onClick={(e) => {
                e.stopPropagation();
                if (isSelected && onCancelSwap) {
                    onCancelSwap(player);
                } else if (onSwap) {
                    onSwap(player);
                }
            }}
        >
            {/* Rank/Photo */}
            <div className="relative w-12 h-12 shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-slate-900">
                    <img
                        src={headshotUrl}
                        alt={player.name}
                        onError={(e) => e.currentTarget.src = fallbackHeadshot}
                        className={cn("w-full h-full object-cover object-top scale-125 pt-1", injury && "grayscale")}
                    />
                </div>
                {injury && (
                    <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-red-400 shadow-sm">
                        INJ
                    </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center border border-white/10 text-[10px] font-bold text-gray-400">
                    {player.position}
                </div>
            </div>

            {/* Name & Team */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="text-white font-bold truncate">{player.name}</h4>
                    {player.pendingSlot && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold uppercase">
                            Pending Swap
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span>{teamAbbrev}</span>
                    <span className="w-0.5 h-0.5 bg-gray-600 rounded-full" />
                    <span>#{player.jerseyNumber}</span>
                </div>
            </div>

            {/* Stats Columns */}
            <div className="flex items-center gap-6 text-sm">
                <div className="flex flex-col items-end w-12 hidden sm:flex">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">GP</span>
                    <span className="text-gray-300 font-mono">{stats.gamesPlayed}</span>
                </div>
                <div className="flex flex-col items-end w-12 hidden sm:flex">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">G</span>
                    <span className="text-white font-mono font-bold">{stats.goals}</span>
                </div>
                <div className="flex flex-col items-end w-12 hidden sm:flex">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">A</span>
                    <span className="text-white font-mono font-bold">{stats.assists}</span>
                </div>
                <div className="flex flex-col items-end w-16">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Avg</span>
                    <span className={cn("font-mono font-bold", getAvgColor(stats.avgPoints))}>
                        {stats.avgPoints.toFixed(1)}
                    </span>
                </div>
                <div className="flex flex-col items-end w-16">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Total</span>
                    <span className="text-2xl font-black text-white leading-none">
                        {fantasyPoints.toFixed(0)}
                    </span>
                </div>
            </div>
        </div>
    );
}
