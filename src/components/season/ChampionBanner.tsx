import { Trophy } from 'lucide-react';

import type { SeasonArchive } from '../../../packages/core/season/types';
import { useCountUp } from '../../hooks/useCountUp';
import { cn } from '../../lib/utils';
import { GlassCard } from '../ui/GlassCard';
import { Icon } from '../ui/Icon';

const medalCls = (rank: number) =>
    rank === 1 ? 'bg-rank text-slate-950'
        : rank === 2 ? 'bg-slate-300 text-slate-950'
            : 'bg-amber-600 text-slate-950';

export function ChampionBanner({ archive, myTeamName }: { archive: SeasonArchive; myTeamName: string | null }) {
    const animatedPoints = useCountUp(archive.champion.totalPoints, 1, 'champion-points');
    const isMe = myTeamName === archive.champion.teamName;

    return (
        <GlassCard className="relative overflow-hidden p-8 border-rank/40 shadow-glow-gold">
            <div className="absolute inset-0 bg-gradient-to-br from-rank/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-rank flex items-center gap-2">
                        <Icon as={Trophy} size="sm" className="text-rank" glow />
                        {archive.seasonId} Season Champions
                    </p>
                    <h2 className="text-5xl font-heading font-black text-white mt-2 uppercase tracking-wide drop-shadow-[0_0_25px_rgba(250,204,21,0.35)]">
                        {archive.champion.teamName}
                    </h2>
                    <p className="text-slate-300 mt-2">
                        {isMe ? 'That’s you. Take a bow, GM.' : 'A season for the history books.'}
                    </p>
                    <p className="text-rank text-3xl font-black mt-3 tabular-nums">{animatedPoints} pts</p>
                </div>
                <div className="flex md:flex-col gap-2">
                    {archive.standings.slice(0, 3).map((team) => (
                        <div key={team.teamName} className="flex items-center gap-2.5 bg-slate-900/70 rounded-card px-4 py-2.5">
                            <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold', medalCls(team.rank))}>
                                {team.rank}
                            </span>
                            <span className="text-sm font-semibold text-white flex-1">{team.teamName}</span>
                            <span className="text-sm font-extrabold text-points tabular-nums">{team.totalPoints.toFixed(1)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </GlassCard>
    );
}
