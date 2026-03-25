import type { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

import { DEFAULT_ROSTER_SETTINGS, DEFAULT_SCORING_RULES } from '../constants/scoring';
import { db } from '../firebase';
import type { CreateLeagueData, League } from '../types/league';

const CURRENT_LEAGUE_STORAGE_KEY = 'currentLeagueId';

function getStoredLeagueId(): string | null {
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

export async function findLeagueIdForUser(userId: string): Promise<string | null> {
  const savedLeagueId = getStoredLeagueId();
  if (savedLeagueId) {
    const leagueDoc = await getDoc(doc(db, 'leagues', savedLeagueId));
    if (leagueDoc.exists()) {
      const leagueData = leagueDoc.data() as Omit<League, 'id'>;
      if (leagueData.teams.some(team => team.ownerUid === userId)) {
        return savedLeagueId;
      }
    }

    storeCurrentLeagueId(null);
  }

  const snapshot = await getDocs(collection(db, 'leagues'));
  for (const leagueDoc of snapshot.docs) {
    const leagueData = leagueDoc.data() as Omit<League, 'id'>;
    if (leagueData.teams.some(team => team.ownerUid === userId)) {
      storeCurrentLeagueId(leagueDoc.id);
      return leagueDoc.id;
    }
  }

  return null;
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'leagues', leagueId), leagueData);
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
