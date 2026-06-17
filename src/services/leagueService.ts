import type { User } from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';

import { DEFAULT_MAX_TEAMS, DEFAULT_ROSTER_SETTINGS, DEFAULT_SCORING_RULES } from '../constants/scoring';
import { db } from '../firebase';
import type { CreateLeagueData, League } from '../types/league';
import { rotateInviteCode } from './membershipService';

const CURRENT_LEAGUE_STORAGE_KEY = 'currentLeagueId';

export function getStoredLeagueId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(CURRENT_LEAGUE_STORAGE_KEY);
}

export function storeCurrentLeagueId(leagueId: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (leagueId) {
    window.localStorage.setItem(CURRENT_LEAGUE_STORAGE_KEY, leagueId);
  } else {
    window.localStorage.removeItem(CURRENT_LEAGUE_STORAGE_KEY);
  }
}

export interface LeagueSummary {
  id: string;
  leagueName: string;
}

/** Pure: map a raw league doc into the lightweight summary used by the switcher. */
export function toLeagueSummary(id: string, data: Record<string, unknown>): LeagueSummary {
  const leagueName = typeof data.leagueName === 'string' && data.leagueName ? data.leagueName : 'Untitled League';
  return { id, leagueName };
}

/** All leagues the user is a member of (admin + team owners live in memberUids). */
export async function listLeaguesForUser(userId: string): Promise<LeagueSummary[]> {
  const q = query(collection(db, 'leagues'), where('memberUids', 'array-contains', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toLeagueSummary(d.id, d.data()));
}

export function subscribeToLeague(
  leagueId: string,
  onLeague: (league: League | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'leagues', leagueId),
    (snapshot) => {
      if (snapshot.exists()) {
        onLeague({ id: snapshot.id, ...snapshot.data() } as League);
        return;
      }

      onLeague(null);
    },
    (error) => onError(error),
  );
}

export async function createLeague(user: User, data: CreateLeagueData): Promise<string> {
  const leagueId = `league-${Date.now()}`;
  const memberUids = [
    user.uid,
    ...data.teams.map(team => team.ownerUid).filter(uid => uid && uid !== user.uid),
  ];

  const leagueData: Omit<League, 'id'> = {
    leagueName: data.leagueName,
    admin: user.uid,
    status: 'pending',
    teams: data.teams,
    memberUids,
    draftRounds: data.draftRounds || 15,
    scoringRules: DEFAULT_SCORING_RULES,
    rosterSettings: DEFAULT_ROSTER_SETTINGS,
    allowedGameTypes: data.allowedGameTypes || [2],
    maxTeams: data.maxTeams ?? DEFAULT_MAX_TEAMS,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'leagues', leagueId), leagueData);
  try {
    await rotateInviteCode(leagueId);
  } catch (err) {
    console.error('Failed to generate initial invite code:', err);
  }
  storeCurrentLeagueId(leagueId);
  return leagueId;
}

export async function updateLeagueDocument(
  leagueId: string,
  updates: Partial<League>,
  adminUid?: string,
) {
  const updatesWithMemberUids = { ...updates };

  if (updates.teams) {
    updatesWithMemberUids.memberUids = [
      ...(adminUid ? [adminUid] : []),
      ...updates.teams.map(team => team.ownerUid).filter(uid => uid && uid !== adminUid),
    ];
  }

  await updateDoc(doc(db, 'leagues', leagueId), {
    ...updatesWithMemberUids,
    updatedAt: new Date().toISOString(),
  });
}

export async function startLeagueDraft(leagueId: string) {
  await updateDoc(doc(db, 'leagues', leagueId), {
    status: 'live',
    updatedAt: new Date().toISOString(),
  });
}
