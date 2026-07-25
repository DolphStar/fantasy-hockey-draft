import { History, Trophy } from 'lucide-react';

import type { SeasonArchive } from '../../../packages/core/season/types';
import { CardHeader } from '../ui/CardHeader';
import { GlassCard } from '../ui/GlassCard';
import { Icon } from '../ui/Icon';

export function SeasonHistoryCard({ archives }: { archives: SeasonArchive[] }) {
    if (archives.length === 0) return null;
    return (
        <GlassCard>
            <CardHeader icon={<Icon as={History} size="sm" className="text-slate-400" />} title="Season History" />
            {archives.map((a) => (
                <div key={a.seasonId} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 last:border-b-0">
                    <span className="text-sm font-semibold text-slate-300">{a.seasonId}</span>
                    <span className="flex items-center gap-2 text-sm text-white font-bold">
                        <Icon as={Trophy} size="sm" className="text-rank" />
                        {a.champion.teamName}
                    </span>
                    <span className="text-sm font-extrabold text-white tabular-nums">{a.champion.totalPoints.toFixed(1)}</span>
                </div>
            ))}
        </GlassCard>
    );
}
