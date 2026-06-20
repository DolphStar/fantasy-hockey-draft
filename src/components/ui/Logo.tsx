import { cn } from '../../lib/utils';

/**
 * App brand mark — the stylized crossed-sticks "V" in a glassy badge.
 * Size the badge via `className` (e.g. `w-10 h-10`); the glyph scales to fit.
 * Used in the app header and on the Login screen.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-slate-900/80 border border-white/15 flex items-center justify-center shadow-inner shadow-blue-900/40',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 4l7.5 13" className="text-blue-400" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 4h3l7 13h-3z" className="text-blue-200/80" fill="currentColor" fillOpacity="0.15" />
        <path d="M19 4L11.5 17" className="text-cyan-300" stroke="currentColor" strokeWidth="1.6" />
        <ellipse cx="12" cy="19" rx="4" ry="1.4" className="text-blue-500/60" fill="currentColor" />
      </svg>
    </div>
  );
}
