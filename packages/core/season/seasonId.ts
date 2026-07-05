/** NHL season id like '2025-26'. Seasons roll over on Oct 1 (UTC). */
export function nhlSeasonIdForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 9 ? year : year - 1; // month 9 = October
  return formatSeasonId(startYear);
}

/** '2025-26' -> '2026-27'. */
export function nextSeasonId(seasonId: string): string {
  const startYear = Number(seasonId.slice(0, 4));
  return formatSeasonId(startYear + 1);
}

function formatSeasonId(startYear: number): string {
  const endTwoDigits = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endTwoDigits}`;
}
