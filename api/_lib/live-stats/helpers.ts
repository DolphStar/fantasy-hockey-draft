/**
 * Pure helpers for live-stats orchestration (no Firestore / network).
 */

export interface ScorePair {
  awayScore: number;
  homeScore: number;
}

/** Minimal fields read from an existing liveStats doc for merge / FINAL logic. */
export interface LiveStatSnapshot extends ScorePair {
  goals: number;
  assists: number;
}

/**
 * When the schedule API briefly returns 0-0, keep non-zero scores we already stored.
 */
export function resolveDisplayedScores(
  apiAway: number,
  apiHome: number,
  existing?: Pick<LiveStatSnapshot, 'awayScore' | 'homeScore'> | null,
): ScorePair {
  const apiA = apiAway || 0;
  const apiH = apiHome || 0;
  if (
    apiA === 0 &&
    apiH === 0 &&
    existing &&
    (existing.awayScore > 0 || existing.homeScore > 0)
  ) {
    return { awayScore: existing.awayScore, homeScore: existing.homeScore };
  }
  return { awayScore: apiA, homeScore: apiH };
}

export function shouldSkipPreviousDayFinalWithoutStoredSample(params: {
  isPreviousDayGame: boolean;
  hasExistingLiveDoc: boolean;
}): boolean {
  return params.isPreviousDayGame && !params.hasExistingLiveDoc;
}

/**
 * Resolves displayed scores and whether to skip the rest of processing for this game,
 * matching legacy `src/utils/liveStats` FINAL / 0-0 behavior.
 */
export function resolveLiveGameDisplayScores(
  gameState: string,
  apiAway: number,
  apiHome: number,
  existing: LiveStatSnapshot | null | undefined,
): ScorePair & { skipRestOfGame: boolean } {
  const merged = resolveDisplayedScores(apiAway, apiHome, existing);
  let awayScore = merged.awayScore;
  let homeScore = merged.homeScore;

  const apiA = apiAway || 0;
  const apiH = apiHome || 0;
  const isFinal = gameState === 'FINAL' || gameState === 'OFF';

  if (!isFinal) {
    return { awayScore, homeScore, skipRestOfGame: false };
  }

  if (existing) {
    const hasZeroPoints = existing.goals === 0 && existing.assists === 0;
    if (apiA !== existing.awayScore || apiH !== existing.homeScore) {
      awayScore = apiA;
      homeScore = apiH;
      return { awayScore, homeScore, skipRestOfGame: false };
    }
    if (hasZeroPoints) {
      return { awayScore, homeScore, skipRestOfGame: false };
    }
    if (apiA > 0 || apiH > 0) {
      return { awayScore, homeScore, skipRestOfGame: true };
    }
  }

  return { awayScore, homeScore, skipRestOfGame: false };
}
