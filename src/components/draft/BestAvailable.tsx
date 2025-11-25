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
    const [isCollapsed, setIsCollapsed] = useState(true); // Closed by default

    if (!best) return null;

    const playersToShow = best[filter];

    const getScarcityColor = (count: number) => {
        if (count < 10) return 'text-red-500';
        if (count < 20) return 'text-amber-500';
        return 'text-emerald-500';
    };

    return (
        <GlassCard className={`mb-6 transition-all duration-300 ${isCollapsed ? 'p-3' : 'p-4'} border-amber-500/20 hover:border-amber-500/40`}>
            {/* Header - clickable to toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full flex justify-between items-center group"
            >
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400">🔥</span> Best Available
                    {isCollapsed && (
                        <span className="text-xs font-normal text-slate-500 ml-2">
                            Click to expand
                        </span>
                    )}
                </h3>
                <div className="flex items-center gap-2">
                    {!isCollapsed && (
                        <div className="flex gap-1 bg-slate-800/60 p-0.5 rounded-lg" onClick={e => e.stopPropagation()}>
                            {(['overall', 'forwards', 'defense', 'goalies'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFilter(f);
                                    }}
                                    className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${filter === f
                                        ? 'bg-amber-500 text-slate-900 shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}
                    <span className={`text-slate-500 group-hover:text-slate-300 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>
                        ▼
                    </span>
                </div>
            </button>

            {/* Expandable content */}
            <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[800px] opacity-100 mt-4'}`}>
                <div className="space-y-1.5">
                    {playersToShow.map((player, i) => {
                        const stats = lastSeasonStats[player.person.id];
                        const isGoalie = player.position.code === 'G';
                        const teamAbbrev = (player as any).teamAbbrev;
                        const headshotUrl = `https://assets.nhle.com/mugs/nhl/20242025/${teamAbbrev}/${player.person.id}.png`;

                        return (
                            <div 
                                key={player.person.id} 
                                className="flex items-center justify-between bg-slate-800/40 hover:bg-slate-700/60 px-3 py-2 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="text-slate-600 font-mono text-[10px] w-3 text-right">{i + 1}</div>
                                    <img 
                                        src={headshotUrl} 
                                        alt="" 
                                        className="w-8 h-8 rounded-full object-cover bg-slate-700/50 border border-slate-600/30"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                    <div>
                                        <div className="font-semibold text-slate-200 text-sm group-hover:text-white transition-colors">
                                            {getPlayerFullName(player)}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                            <Badge 
                                                variant="outline" 
                                                className={`text-[9px] px-1.5 py-0 h-4 ${
                                                    ['C', 'L', 'R'].includes(player.position.code) 
                                                        ? 'border-blue-500/40 text-blue-400' 
                                                        : player.position.code === 'D' 
                                                            ? 'border-emerald-500/40 text-emerald-400'
                                                            : 'border-amber-500/40 text-amber-400'
                                                }`}
                                            >
                                                {player.position.code}
                                            </Badge>
                                            <span className="text-slate-500">{teamAbbrev}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-right min-w-[40px]">
                                        <div className="text-amber-400 font-bold font-mono text-sm">
                                            {isGoalie ? (stats?.wins || 0) : (stats?.points || 0)}
                                        </div>
                                        <div className="text-[8px] text-slate-500 uppercase tracking-wide">
                                            {isGoalie ? 'Wins' : 'Pts'}
                                        </div>
                                    </div>

                                    {isMyTurn && (
                                        <button
                                            onClick={() => onDraft(player)}
                                            className="bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition-all opacity-0 group-hover:opacity-100 shadow-sm"
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
                    <div className="mt-4 pt-4 border-t border-slate-700/40">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <span className="text-blue-400">📊</span> Position Scarcity
                        </h4>
                        <div className="grid grid-cols-5 gap-2 text-center">
                            {(['C', 'L', 'R', 'D', 'G'] as const).map(pos => (
                                <div 
                                    key={pos} 
                                    className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/40 hover:border-slate-600/50 transition-colors"
                                >
                                    <div className={`text-[10px] font-bold mb-0.5 ${
                                        pos === 'C' || pos === 'L' || pos === 'R' ? 'text-blue-400' :
                                        pos === 'D' ? 'text-emerald-400' : 'text-amber-400'
                                    }`}>
                                        {pos}
                                    </div>
                                    <div className={`text-lg font-black ${getScarcityColor(scarcity.remainingCounts[pos])}`}>
                                        {scarcity.remainingCounts[pos]}
                                    </div>
                                    <div className="text-[8px] text-slate-500 uppercase tracking-wide">left</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </GlassCard>
    );
}
