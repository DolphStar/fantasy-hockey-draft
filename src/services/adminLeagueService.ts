import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';

import { db } from '../firebase';

export interface TeamRosterCounts {
  F: number;
  D: number;
  G: number;
  reserve: number;
}

export interface AutoDraftCandidate {
  person: { id: number };
  jerseyNumber: string;
  position: {
    code: string;
    name: string;
  };
  teamAbbrev: string;
}

export interface DraftOrderPick {
  pick: number;
  round: number;
}

export async function fetchDraftedRosterStatus(leagueId: string): Promise<{
  draftedPlayerIds: Set<number>;
  teamRosters: Record<string, TeamRosterCounts>;
}> {
  const snapshot = await getDocs(
    query(collection(db, 'draftedPlayers'), where('leagueId', '==', leagueId)),
  );
  const draftedPlayerIds = new Set<number>();
  const teamRosters: Record<string, TeamRosterCounts> = {};

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data() as {
      playerId: number;
      draftedByTeam: string;
      position: string;
      rosterSlot?: 'active' | 'reserve';
    };

    draftedPlayerIds.add(data.playerId);

    if (!teamRosters[data.draftedByTeam]) {
      teamRosters[data.draftedByTeam] = { F: 0, D: 0, G: 0, reserve: 0 };
    }

    const roster = teamRosters[data.draftedByTeam];
    const slot = data.rosterSlot || 'active';

    if (slot === 'reserve') {
      roster.reserve += 1;
    } else if (['C', 'L', 'R'].includes(data.position)) {
      roster.F += 1;
    } else if (data.position === 'D') {
      roster.D += 1;
    } else if (data.position === 'G') {
      roster.G += 1;
    }
  });

  return { draftedPlayerIds, teamRosters };
}

export async function commitAutoDraftPick(params: {
  leagueId: string;
  teamName: string;
  currentPickNumber: number;
  totalPicks: number;
  draftPick: DraftOrderPick;
  selectedPlayer: AutoDraftCandidate;
  selectedPlayerName: string;
  rosterSlot: 'active' | 'reserve';
}) {
  const {
    leagueId,
    teamName,
    currentPickNumber,
    totalPicks,
    draftPick,
    selectedPlayer,
    selectedPlayerName,
    rosterSlot,
  } = params;

  const draftRef = doc(db, 'drafts', leagueId);

  await runTransaction(db, async (transaction) => {
    const draftedPlayerRef = doc(collection(db, 'draftedPlayers'));
    transaction.set(draftedPlayerRef, {
      playerId: selectedPlayer.person.id,
      name: selectedPlayerName,
      position: selectedPlayer.position.code,
      positionName: selectedPlayer.position.name,
      jerseyNumber: selectedPlayer.jerseyNumber,
      nhlTeam: selectedPlayer.teamAbbrev || 'UNK',
      draftedByTeam: teamName,
      pickNumber: draftPick.pick,
      round: draftPick.round,
      leagueId,
      draftedAt: new Date().toISOString(),
      rosterSlot,
    });

    const nextPickNumber = currentPickNumber + 1;
    transaction.update(draftRef, {
      currentPickNumber: nextPickNumber,
      isComplete: nextPickNumber > totalPicks,
    });
  });
}
