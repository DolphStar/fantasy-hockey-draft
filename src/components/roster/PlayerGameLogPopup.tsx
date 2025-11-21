import { cn } from '../../lib/utils';

interface GameLogEntry {
    date: string;
    points: number;
    opponent?: string;
}

interface PlayerGameLogPopupProps {
    playerName: string;
    recentGames: GameLogEntry[];
    projectedPoints: number;
    injury?: { status: string };
    notes?: string[];
    className?: string;
}

export default function PlayerGameLogPopup({
    playerName,
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
                'w-72 bg-slate-900/95 backdrop-blur-xl rounded-xl border-2 border-white/20',
                'shadow-[0_0_30px_rgba(0,0,0,0.5)] p-4',
                'pointer-events-none',
                className
            )}
        >
            {/* Arrow pointing down */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[2px]">
                <div className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white/20" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-[1px]">
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900/95" />
                </div>
            </div>

            {/* Header */}
            <div className="mb-3 pb-2 border-b border-white/10">
                <h4 className="text-white font-bold text-sm mb-1">{playerName}</h4>
                <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">Avg:</span>
                        <span className="text-white font-semibold">{avgPoints} pts</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">Projected:</span>
                        <span className="text-cyan-400 font-semibold">{projectedPoints.toFixed(1)} pts</span>
                    </div>
                    {trend !== 'neutral' && (
                        <div className={cn(
                            "flex items-center gap-1",
                            trend === 'up' ? 'text-green-400' : 'text-red-400'
                        )}>
                            {trend === 'up' ? '↑' : '↓'}
                            <span className="font-semibold text-[10px]">
                                {trend === 'up' ? 'HOT' : 'COLD'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Last 5 Games */}
            <div className="mb-3">
                <h5 className="text-gray-300 font-semibold text-xs uppercase tracking-wide mb-2">
                    Last {recentGames.length} Games
                </h5>
                {recentGames.length > 0 ? (
                    <div className="space-y-1">
                        {recentGames.slice(-5).reverse().map((game, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between text-xs bg-white/5 rounded px-2 py-1"
                            >
                                <span className="text-gray-400 font-mono">
                                    {new Date(game.date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </span>
                                {game.opponent && (
                                    <span className="text-gray-500 text-[10px]">vs {game.opponent}</span>
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
                <div className="pt-2 border-t border-white/10">
                    <h5 className="text-gray-300 font-semibold text-xs uppercase tracking-wide mb-1">
                        Notes
                    </h5>
                    <div className="space-y-1">
                        {injury && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-red-400">⚠</span>
                                <span className="text-red-300">Injury: {injury.status}</span>
                            </div>
                        )}
                        {notes.map((note, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs">
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
