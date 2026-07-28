import { cn } from '../../lib/utils';

/**
 * App brand mark — centre ice.
 *
 * The faceoff circle is the most recognisable marking on a rink, it's already
 * the motif running under every page, and dropping the puck at centre is how a
 * game starts, which is what a draft is. Being a circle, it also survives 16px
 * in a browser tab — the old crossed-stick "V" badge did not.
 *
 * The centre red line crossing it is doing real work: a bare ring-and-dot reads
 * as a record, a target or a camera. The line is what makes it a rink.
 *
 * Size it via `className` (e.g. `w-9 h-9`). No enclosing badge — a rounded
 * square around it only made it look like a generic app icon.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('block', className)}
      fill="none"
      role="img"
      aria-label="Fantasy Hockey Draft"
    >
      {/* Centre line, overhanging the circle so it reads as crossing the ice */}
      <path d="M16 2.5V29.5" className="text-paint/60" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />

      {/* Faceoff circle */}
      <circle cx="16" cy="16" r="10.5" className="text-paint" stroke="currentColor" strokeWidth="2" />

      {/* The puck on the dot — drawn last so it sits over the line */}
      <circle cx="16" cy="16" r="3.6" className="text-slate-100" fill="currentColor" />
    </svg>
  );
}
