/** Cubic ease-out: fast start, gentle landing. p in [0,1]. */
export function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

/** Fixed-precision formatter used by count-up displays. */
export function formatCount(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

const COUNT_UP_SEEN_PREFIX = 'countup:seen:';

/**
 * A count-up is a first-impression flourish, so each surface plays it once per
 * browser tab session rather than on every refresh. sessionStorage is the right
 * scope: it survives a reload, resets on a new tab, and never outlives the
 * visit. If storage is blocked (private mode) the animation simply plays again.
 */
export function hasCountUpPlayed(scope: string | undefined): boolean {
  if (!scope) return false;
  try {
    return globalThis.sessionStorage?.getItem(COUNT_UP_SEEN_PREFIX + scope) === '1';
  } catch {
    return false;
  }
}

export function markCountUpPlayed(scope: string | undefined): void {
  if (!scope) return;
  try {
    globalThis.sessionStorage?.setItem(COUNT_UP_SEEN_PREFIX + scope, '1');
  } catch {
    // Storage unavailable — nothing to remember, the flourish just replays.
  }
}
