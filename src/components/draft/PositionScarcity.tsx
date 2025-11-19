import { GlassCard } from '../ui/GlassCard';
import { usePositionScarcity } from '../../hooks/usePositionScarcity';
import type { RosterPerson } from '../../utils/nhlApi';

interface PositionScarcityProps {
    allPlayers: RosterPerson[];
    draftedPlayerIds: Set<number>;
}

export default function PositionScarcity({ allPlayers, draftedPlayerIds }: PositionScarcityProps) {
    const scarcity = usePositionScarcity(allPlayers, draftedPlayerIds);

    if (!scarcity) return null;

    const { remainingCounts } = scarcity;

    // Calculate percentages or raw numbers to show "panic meter"
    // For now, just simple counts of remaining players

    const getScarcityColor = (count: number) => {
        if (count < 10) return 'text-red-500';
        if (count < 20) return 'text-amber-500';
        return 'text-emerald-500';
    };

    return (
        <GlassCard className="p-4 mb-6">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                📊 Position Scarcity
            </h3>
            <div className="grid grid-cols-5 gap-2 text-center">
                {(['C', 'L', 'R', 'D', 'G'] as const).map(pos => (
                    <div key={pos} className="bg-slate-800/50 rounded p-2 border border-slate-700">
                        <div className="text-xs text-slate-400 font-bold">{pos}</div>
                        <div className={`text-xl font-black ${getScarcityColor(remainingCounts[pos])}`}>
                            {remainingCounts[pos]}
                        </div>
                        <div className="text-[10px] text-slate-500">left</div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
