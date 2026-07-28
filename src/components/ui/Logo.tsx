import { cn } from '../../lib/utils';

/**
 * App brand mark — the flaming stick and puck.
 *
 * Raster rather than SVG because the artwork is a rendered illustration with
 * gradients and glow, not something that reduces to paths. It ships as a
 * transparent PNG: the source had a near-black background baked in, which was
 * keyed out by flood-filling from the border so the puck — dark, but fully
 * ringed by its bright rim — survived.
 *
 * Size it via `className` (e.g. `w-9 h-9`). The file is square and padded, so
 * any square box keeps the aspect.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Fantasy Hockey Draft"
      width={512}
      height={512}
      className={cn('block object-contain', className)}
    />
  );
}
