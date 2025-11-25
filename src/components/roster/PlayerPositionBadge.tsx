import { cn } from '../../lib/utils';

interface PlayerPositionBadgeProps {
  position: string;
  className?: string;
}

const POSITION_COLORS: Record<string, { outer: string; inner: string }> = {
  forward: {
    outer: 'bg-gradient-to-b from-blue-400 via-blue-600 to-slate-900',
    inner: 'from-blue-600/50 to-slate-900',
  },
  defense: {
    outer: 'bg-gradient-to-b from-emerald-300 via-emerald-500 to-slate-900',
    inner: 'from-emerald-500/50 to-slate-900',
  },
  goalie: {
    outer: 'bg-gradient-to-b from-amber-300 via-amber-400 to-slate-900',
    inner: 'from-amber-400/50 to-slate-900',
  },
};

export function PlayerPositionBadge({ position, className }: PlayerPositionBadgeProps) {
  const pos = position?.toUpperCase() || '';
  const palette = ['C', 'L', 'R'].includes(pos)
    ? POSITION_COLORS.forward
    : pos === 'D'
      ? POSITION_COLORS.defense
      : POSITION_COLORS.goalie;

  return (
    <div
      className={cn(
        'absolute top-3 right-3 z-30 w-12 h-14 flex items-center justify-center shadow-[0_4px_6px_rgba(0,0,0,0.3)] text-white font-black text-lg',
        palette.outer,
        className,
      )}
      style={{
        clipPath: 'polygon(50% 0%, 100% 20%, 100% 85%, 50% 100%, 0% 85%, 0% 20%)',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none mix-blend-overlay" />
      <div
        className="absolute inset-[1px] bg-slate-900 z-0"
        style={{ clipPath: 'polygon(50% 0%, 100% 20%, 100% 85%, 50% 100%, 0% 85%, 0% 20%)' }}
      />
      <div
        className={cn('absolute inset-[2px] z-0 bg-gradient-to-br', palette.inner)}
        style={{ clipPath: 'polygon(50% 0%, 100% 20%, 100% 85%, 50% 100%, 0% 85%, 0% 20%)' }}
      />
      <span className="relative z-10 drop-shadow-md">{pos}</span>
    </div>
  );
}
