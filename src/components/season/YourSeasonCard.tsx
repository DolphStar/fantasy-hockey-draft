import { UserRound } from 'lucide-react';

import type { TeamSummary } from '../../../packages/core/season/types';
import { cn } from '../../lib/utils';
import { CardHeader } from '../ui/CardHeader';
import { GlassCard } from '../ui/GlassCard';
import { Icon } from '../ui/Icon';

export function YourSeasonCard({ summary, medalClass }: { summary: TeamSummary; medalClass: string }) {
  return (
    <GlassCard>
      <CardHeader icon={<Icon as={UserRound} size="sm" className="text-blue-400" />} title="Your Season" />
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-500">Finish</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold', medalClass)}>{summary.rank}</span>
            <span className="text-white font-bold">{summary.rank === 1 ? 'Champion' : `#${summary.rank}`}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-500">Points</div>
          <div className="text-white font-extrabold text-xl tabular-nums mt-1">{summary.totalPoints.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-500">Top Player</div>
          <div className="text-white font-semibold mt-1 truncate">{summary.topPlayer?.name ?? '—'}</div>
          {summary.topPlayer && <div className="text-[11px] text-slate-400">{summary.topPlayer.points.toFixed(1)} pts</div>}
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-500">Best Pick</div>
          <div className="text-white font-semibold mt-1 truncate">{summary.bestPick?.name ?? '—'}</div>
          {summary.bestPick && <div className="text-[11px] text-slate-500">R{summary.bestPick.round} · {summary.bestPick.points.toFixed(1)} pts</div>}
        </div>
      </div>
    </GlassCard>
  );
}
