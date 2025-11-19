import { useState } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { useBestAvailable } from '../../hooks/useBestAvailable';
import { usePositionScarcity } from '../../hooks/usePositionScarcity';
import type { RosterPerson } from '../../utils/nhlApi';
import { getPlayerFullName } from '../../utils/nhlApi';

interface BestAvailableProps {
    allPlayers: RosterPerson[];
    draftedPlayerIds: Set<number>;
    lastSeasonStats: any;
    onDraft: (player: RosterPerson) => void;
    isMyTurn: boolean;
}

export default function BestAvailable({ allPlayers, draftedPlayerIds, lastSeasonStats, onDraft, isMyTurn }: BestAvailableProps) {
    const best = useBestAvailable(allPlayers, draftedPlayerIds, lastSeasonStats);
    const scarcity = usePositionScarcity(allPlayers, draftedPlayerIds);
    const [filter, setFilter] = useState<'overall' | 'forwards' | 'defense' | 'goalies'>('overall');
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (!best) return null;

    const playersToShow = best[filter];

    const getScarcityColor = (count: number) => {
        if (count < 10) return 'text-red-500';
        if (count < 20) return 'text-amber-500';
        return 'text-emerald-500';
    };

    return (
        <GlassCard className="p-4 mb-6 border-amber-500/30">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    🔥 Best Available
                </h3>
                <div className="flex items-center gap-2">
                    {!isCollapsed && (
                        <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
                            {(['overall', 'forwards', 'defense', 'goalies'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filter === f
                                        ? 'bg-amber-500 text-black'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                        }`}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="text-slate-400 hover:text-white transition-colors px-2 py-1 hover:bg-slate-700/50 rounded"
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        {isCollapsed ? '▼' : '▲'}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <>
                    <div className="space-y-2 mb-4">
                        {playersToShow.map((player, i) => {
                            const stats = lastSeasonStats[player.person.id];
                            const isGoalie = player.position.code === 'G';

                            return (
                                <div key={player.person.id} className="flex items-center justify-between bg-slate-800/30 hover:bg-slate-700/50 p-2 rounded border border-slate-700/30 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="text-slate-500 font-mono text-xs w-4">{i + 1}</div>
                                        <div>
                                            <div className="font-bold text-slate-200 text-sm group-hover:text-white">
                                                {getPlayerFullName(player)}
                                            </div>
                                            <div className="flex gap-2 text-[10px] text-slate-400">
                                                <Badge variant="outline" className="scale-75 origin-left">{player.position.code}</Badge>
                                                <span>{(player as any).teamAbbrev}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-amber-400 font-bold font-mono text-sm">
                                                {isGoalie ? (stats?.wins || 0) : (stats?.points || 0)}
                                            </div>
                                            <div className="text-[9px] text-slate-500 uppercase">
                                                {isGoalie ? 'Wins' : 'Pts'}
                                            </div>
                                        </div>

                                        {isMyTurn && (
                                            <button
                                                onClick={() => onDraft(player)}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                Draft
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Position Scarcity Section */}
                    {scarcity && (
                        <>
                            <div className="border-t border-slate-700/50 my-4"></div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    📊 Position Scarcity
                                </h3>
                                <div className="grid grid-cols-5 gap-2 text-center">
                                    {(['C', 'L', 'R', 'D', 'G'] as const).map(pos => (
                                        <div key={pos} className="bg-slate-800/50 rounded p-2 border border-slate-700">
                                            <div className={`text-xs font-bold mb-1 ${pos === 'C' || pos === 'L' || pos === 'R' ? 'text-red-400' :
                                                    pos === 'D' ? 'text-green-400' : 'text-blue-400'
                                                }`}>
                                                {pos}
                                            </div>
                                            <div className={`text-xl font-black ${getScarcityColor(scarcity.remainingCounts[pos])}`}>
                                                {scarcity.remainingCounts[pos]}
                                            </div>
                                            <div className="text-[10px] text-slate-500">left</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </GlassCard>
    );
}
