/** Cubic ease-out: fast start, gentle landing. p in [0,1]. */
export function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

/** Fixed-precision formatter used by count-up displays. */
export function formatCount(value: number, decimals: number): string {
  return value.toFixed(decimals);
}
