import { cn } from '../../lib/utils';

interface GameLogEntry {
    date: string;
    points: number;
    opponent?: string;
}

interface PlayerGameLogPopupProps {
    recentGames: GameLogEntry[];
    projectedPoints: number;
    injury?: { status: string };
    notes?: string[];
    className?: string;
}

export default function PlayerGameLogPopup({
    recentGames,
    projectedPoints,
    injury,
    notes = [],
    className
}: PlayerGameLogPopupProps) {
    // Calculate trend from recent games
    const getTrend = () => {
        if (recentGames.length < 2) return 'neutral';
        const recent = recentGames.slice(-2);
        if (recent[1].points > recent[0].points) return 'up';
        if (recent[1].points < recent[0].points) return 'down';
        return 'neutral';
    };

    const trend = getTrend();
    const avgPoints = recentGames.length > 0
        ? (recentGames.reduce((sum, g) => sum + g.points, 0) / recentGames.length).toFixed(1)
        : '0.0';

    return (
        <div
            className={cn(
                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50',
                'w-72 bg-black/80 backdrop-blur-xl rounded-xl',
                'border border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.5),0_0_30px_rgba(251,191,36,0.15)]',
                'p-4 pointer-events-none',
                className
            )}
        >
            {/* Glow effect overlay */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

            {/* Arrow pointing down */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[2px]">
                <div className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white/20" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-[1px]">
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black/80" />
                </div>
            </div>

            {/* Header - No Name, Just Stats */}
            <div className="mb-3 pb-2 border-b border-white/10 relative z-10">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Avg Points</span>
                        <span className="font-black text-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent drop-shadow-sm filter">
                            {avgPoints}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Projected</span>
                        <span className="font-black text-xl bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm filter">
                            {projectedPoints.toFixed(1)}
                        </span>
                    </div>
                </div>
                {trend !== 'neutral' && (
                    <div className={cn(
                        "absolute top-0 right-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md border",
                        trend === 'up'
                            ? 'text-green-400 border-green-400/30 bg-green-400/10'
                            : 'text-red-400 border-red-400/30 bg-red-400/10'
                    )}>
                        {trend === 'up' ? '↑' : '↓'}
                        <span className="font-bold text-[10px] tracking-wide">
                            {trend === 'up' ? 'HOT' : 'COLD'}
                        </span>
                    </div>
                )}
            </div>

            {/* Last 5 Games */}
            <div className="mb-3 relative z-10">
                <h5 className="text-gray-300 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-1 h-3 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
                    Last {recentGames.length} Games
                </h5>
                {recentGames.length > 0 ? (
                    <div className="space-y-1">
                        {recentGames.slice(-5).reverse().map((game, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between text-xs bg-white/5 hover:bg-white/10 rounded border border-white/5 px-2 py-1.5 backdrop-blur-sm transition-all"
                            >
                                <span className="text-gray-400 font-mono text-[10px]">
                                    {new Date(game.date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </span>
                                {game.opponent && (
                                    <span className="text-gray-500 text-[10px] font-semibold">vs {game.opponent}</span>
                                )}
                                <span className={cn(
                                    "font-bold",
                                    game.points >= 3 ? "text-green-400" :
                                        game.points >= 1 ? "text-white" :
                                            "text-gray-500"
                                )}>
                                    {game.points.toFixed(1)} pts
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-xs italic">No recent games</p>
                )}
            </div>

            {/* Notes Section */}
            {(injury || notes.length > 0) && (
                <div className="pt-2 border-t border-white/10 relative z-10">
                    <h5 className="text-gray-300 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span className="w-1 h-3 bg-gradient-to-b from-red-400 to-red-600 rounded-full" />
                        Notes
                    </h5>
                    <div className="space-y-1">
                        {injury && (
                            <div className="flex items-center gap-2 text-xs bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
                                <span className="text-red-400">⚠</span>
                                <span className="text-red-300 font-semibold">Injury: {injury.status}</span>
                            </div>
                        )}
                        {notes.map((note, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1">
                                <span className="text-blue-400 mt-0.5">•</span>
                                <span className="text-gray-300">{note}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
