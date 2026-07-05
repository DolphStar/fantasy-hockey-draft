import type { SeasonStats } from '../../../packages/core/season/types';
import { GlassCard } from '../ui/GlassCard';
import { StatNumber } from '../ui/StatNumber';

export function SeasonNumbersStrip({ stats, teamCount }: { stats?: SeasonStats; teamCount: number }) {
  if (!stats) return null;
  const tiles: Array<{ label: string; value: string | number; tone: 'points' | 'white' | 'rank' }> = [
    { label: 'Total Points', value: stats.totalPoints.toLocaleString(), tone: 'points' },
    { label: 'Teams', value: teamCount, tone: 'white' },
    { label: 'Avg / Team', value: stats.avgTeamPoints.toLocaleString(), tone: 'white' },
    { label: 'Closest Race', value: stats.runnerUpGap.toFixed(1), tone: 'rank' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <GlassCard key={t.label} className="p-4">
          <StatNumber label={t.label} value={t.value} tone={t.tone} size="lg" className="tabular-nums" />
        </GlassCard>
      ))}
    </div>
  );
}
