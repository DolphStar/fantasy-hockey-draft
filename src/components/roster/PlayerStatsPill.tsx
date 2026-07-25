import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PlayerStatsPillProps {
  goals?: ReactNode;
  assists?: ReactNode;
  avg?: ReactNode;
  goalsLabel?: string;
  assistsLabel?: string;
  avgLabel?: string;
  avgClassName?: string;
  className?: string;
}

export function PlayerStatsPill({
  goals,
  assists,
  avg,
  goalsLabel = 'G',
  assistsLabel = 'A',
  avgLabel = 'AVG',
  avgClassName,
  className,
}: PlayerStatsPillProps) {
  const renderValue = (value: ReactNode, fallback: ReactNode = '—') =>
    value === undefined || value === null || value === '' ? fallback : value;

  return (
    <div
      className={cn(
        // No backdrop-blur: the pill sits on an opaque card face, so the blur was
        // invisible while costing a backdrop pass per card during scroll.
        'flex items-center justify-center gap-3 text-xs font-bold tracking-wider text-gray-300 bg-slate-900/80 py-2 px-5 rounded-full mx-auto w-fit border border-white/10 shadow-lg mb-auto relative overflow-hidden transition-colors group-hover:bg-slate-800/90',
        className,
      )}
    >
      <span className="flex items-center gap-1">
        <span className="text-gray-400">{goalsLabel}:</span>
        <span className="text-white">{renderValue(goals)}</span>
      </span>
      <span className="text-yellow-400">⚡</span>
      <span className="flex items-center gap-1">
        <span className="text-gray-400">{assistsLabel}:</span>
        <span className="text-white">{renderValue(assists)}</span>
      </span>
      <span className="text-yellow-400">⚡</span>
      <span className="flex items-center gap-1">
        <span className="text-gray-400">{avgLabel}:</span>
        <span className={cn('text-white', avgClassName)}>{renderValue(avg)}</span>
      </span>
    </div>
  );
}
