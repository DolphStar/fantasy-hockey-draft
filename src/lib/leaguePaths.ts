import type { LeagueSummary } from '../services/leagueService';

/** Build an absolute app path for a league, e.g. buildLeaguePath('L1','scores') -> '/l/L1/scores'. */
export function buildLeaguePath(leagueId: string, sub?: string): string {
  const base = `/l/${leagueId}`;
  if (!sub) return base;
  return `${base}/${sub.replace(/^\/+/, '')}`;
}

/** Choose the default league id: last-used if still a member, else the first, else null. */
export function pickDefaultLeague(
  memberships: LeagueSummary[],
  lastUsedId: string | null,
): string | null {
  if (lastUsedId && memberships.some((m) => m.id === lastUsedId)) {
    return lastUsedId;
  }
  return memberships[0]?.id ?? null;
}
