import { cn } from '../../lib/utils';

interface StatNumberProps {
  value: string | number;
  /** Micro-label rendered above the number, uppercase */
  label?: string;
  size?: 'md' | 'lg' | 'xl';
  /** Color role; points is the default for fantasy-point values */
  tone?: 'points' | 'white' | 'rank';
  className?: string;
}

const sizes = { md: 'text-xl', lg: 'text-3xl', xl: 'text-4xl' };
const tones = { points: 'text-points', white: 'text-white', rank: 'text-rank' };

/** Big stat number with optional micro-label. Use for every fantasy-point display. */
export function StatNumber({ value, label, size = 'lg', tone = 'points', className }: StatNumberProps) {
  return (
    <div className={cn('leading-tight', className)}>
      {label && (
        <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-500">{label}</div>
      )}
      <div className={cn('font-extrabold', sizes[size], tones[tone])}>{value}</div>
    </div>
  );
}
