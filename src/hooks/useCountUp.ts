import { useEffect, useRef, useState } from 'react';

import { easeOutCubic, formatCount, hasCountUpPlayed, markCountUpPlayed } from '../lib/animation';

const DURATION_MS = 1200;

/**
 * Animates a number from 0 to `target` once per mount (not on later data refreshes).
 * Returns the formatted string. Respects prefers-reduced-motion (renders final value).
 * Pair the consumer with `tabular-nums` so width doesn't jitter.
 *
 * Pass `scope` to make it once per surface per tab session instead: the numbers
 * count up the first time you open that page and render settled on every
 * refresh after it. Grids share one scope, so a whole grid animates together
 * and later-mounted rows (virtualisation, scrolling) don't re-trigger it.
 */
export function useCountUp(target: number, decimals = 1, scope?: string): string {
  // Read the gate during the first render: every card in a grid renders in the
  // same commit, so they all agree before any of them marks the scope played.
  const [alreadyPlayed] = useState(() => hasCountUpPlayed(scope));
  const [display, setDisplay] = useState(() => formatCount(alreadyPlayed ? target : 0, decimals));
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (alreadyPlayed || hasAnimated.current) {
      setDisplay(formatCount(target, decimals));
      return;
    }
    if (target === 0) return; // wait for real data before burning the one animation

    hasAnimated.current = true;
    markCountUpPlayed(scope);

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
  }, [target, decimals, alreadyPlayed, scope]);

  return display;
}
