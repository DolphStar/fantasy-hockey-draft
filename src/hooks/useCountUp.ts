import { useEffect, useRef, useState } from 'react';

import { easeOutCubic, formatCount } from '../lib/animation';

const DURATION_MS = 1200;

/**
 * Animates a number from 0 to `target` once per mount (not on later data refreshes).
 * Returns the formatted string. Respects prefers-reduced-motion (renders final value).
 * Pair the consumer with `tabular-nums` so width doesn't jitter.
 */
export function useCountUp(target: number, decimals = 1): string {
  const [display, setDisplay] = useState(() => formatCount(0, decimals));
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
      setDisplay(formatCount(target, decimals));
      return;
    }
    if (target === 0) return; // wait for real data before burning the one animation

    hasAnimated.current = true;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(formatCount(target, decimals));
      return;
    }

    let frame: number;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const p = Math.min((now - start) / DURATION_MS, 1);
      setDisplay(formatCount(target * easeOutCubic(p), decimals));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, decimals]);

  return display;
}
