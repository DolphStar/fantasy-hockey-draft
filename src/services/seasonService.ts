import { collection, getDocs } from 'firebase/firestore';

import type { SeasonArchive } from '../../packages/core/season/types';
import { db } from '../firebase';
import { authedPost } from './apiClient';

export type { SeasonArchive };

export async function endSeason(leagueId: string): Promise<{ seasonId: string; champion: string }> {
  const data = await authedPost('/api/end-season', { leagueId, action: 'end' });
  return { seasonId: data.seasonId as string, champion: data.champion as string };
}

export async function reopenSeason(leagueId: string): Promise<void> {
  await authedPost('/api/end-season', { leagueId, action: 'reopen' });
}

export async function startNewSeason(leagueId: string): Promise<{ newSeasonId: string }> {
  const data = await authedPost('/api/new-season', { leagueId });
  return { newSeasonId: data.newSeasonId as string };
}

/** All archived seasons for a league, newest first (doc id = seasonId). Few docs
 *  per league, so fetch unordered and sort in JS — avoids a composite index. */
export async function fetchSeasonArchives(leagueId: string): Promise<SeasonArchive[]> {
  const snap = await getDocs(collection(db, `leagues/${leagueId}/seasons`));
  return snap.docs
    .map((d) => d.data() as SeasonArchive)
    .sort((a, b) => b.seasonId.localeCompare(a.seasonId));
}
