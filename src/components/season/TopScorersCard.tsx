import { ListOrdered } from 'lucide-react';

import type { SeasonArchive } from '../../../packages/core/season/types';
import { CardHeader } from '../ui/CardHeader';
import { GlassCard } from '../ui/GlassCard';
import { Icon } from '../ui/Icon';

export function TopScorersCard({ players }: { players: SeasonArchive['topPlayers'] }) {
  if (!players || players.length === 0) return null;
  return (
    <GlassCard>
      <CardHeader icon={<Icon as={ListOrdered} size="sm" className="text-slate-400" />} title="Top Scorers" />
      {players.slice(0, 5).map((p, i) => (
        <div key={p.playerId} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 last:border-b-0">
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-extrabold">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white truncate">{p.name}</span>
              <span className="block text-[11px] text-slate-500">{p.position} · {p.nhlTeam} · {p.draftedByTeam}</span>
            </span>
          </span>
          <span className="text-sm font-extrabold text-white tabular-nums">{p.points.toFixed(1)}</span>
        </div>
      ))}
    </GlassCard>
  );
}
