import { Flame, Shield, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { SeasonAwards as SeasonAwardsData } from '../../../packages/core/season/types';
import { cn } from '../../lib/utils';
import { GlassCard } from '../ui/GlassCard';
import { Icon } from '../ui/Icon';

interface AwardCard {
  key: string;
  title: string;
  icon: LucideIcon;
  accent: string;
  name: string;
  points: number;
  subtitle: string;
  playful?: boolean;
}

export function SeasonAwards({ awards }: { awards?: SeasonAwardsData }) {
  if (!awards) return null;

  const cards: AwardCard[] = [];
  if (awards.mvp) cards.push({ key: 'mvp', title: 'Season MVP', icon: Trophy, accent: 'text-rank', name: awards.mvp.name, points: awards.mvp.points, subtitle: `${awards.mvp.draftedByTeam}'s pick` });
  if (awards.bestSteal) cards.push({ key: 'steal', title: 'Best Draft Steal', icon: TrendingUp, accent: 'text-rank', name: awards.bestSteal.name, points: awards.bestSteal.points, subtitle: `${awards.bestSteal.draftedByTeam}'s pick` });
  if (awards.topGoalie) cards.push({ key: 'goalie', title: 'Top Goalie', icon: Shield, accent: 'text-rank', name: awards.topGoalie.name, points: awards.topGoalie.points, subtitle: `${awards.topGoalie.draftedByTeam}'s pick` });
  if (awards.biggestNight) cards.push({ key: 'night', title: 'Biggest Night', icon: Flame, accent: 'text-orange-400', name: awards.biggestNight.name, points: awards.biggestNight.points, subtitle: awards.biggestNight.date });
  if (awards.biggestBust) cards.push({ key: 'bust', title: 'Biggest Bust', icon: TrendingDown, accent: 'text-slate-400', name: awards.biggestBust.name, points: awards.biggestBust.points, subtitle: `${awards.biggestBust.draftedByTeam}'s pick`, playful: true });

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <GlassCard key={c.key} className={cn('p-4 flex flex-col gap-2', c.playful && 'opacity-90')}>
          <div className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]', c.accent)}>
            <Icon as={c.icon} size="sm" className={c.accent} /> {c.title}
          </div>
          <div className="text-white font-heading font-bold text-lg leading-tight">{c.name}</div>
          <div className="mt-auto flex items-baseline justify-between">
            <span className="text-points font-black text-2xl tabular-nums">{c.points.toFixed(1)}</span>
            <span className="text-[11px] text-slate-500">{c.subtitle}</span>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
