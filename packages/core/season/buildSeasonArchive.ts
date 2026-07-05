import type { SeasonArchive } from './types.js';

export interface BuildSeasonArchiveInput {
  seasonId: string;
  endedAt: string;
  endedBy: 'admin' | 'auto';
  teams: Array<{ teamName: string; ownerUid: string }>;
  teamScores: Array<{ teamName: string; totalPoints: number }>;
  playerTotals: Array<{
    playerId: number;
    name: string;
    position: string;
    nhlTeam: string;
    points: number;
    draftedByTeam: string;
  }>;
}

const TOP_PLAYERS_LIMIT = 10;

/** Pure: final standings + champion + top players from season aggregates. */
export function buildSeasonArchive(input: BuildSeasonArchiveInput): SeasonArchive {
  const ownerByTeam = new Map(input.teams.map((t) => [t.teamName, t.ownerUid]));

  const standings = [...input.teamScores]
    .sort((a, b) => b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName))
    .map((score, index) => ({
      rank: index + 1,
      teamName: score.teamName,
      ownerUid: ownerByTeam.get(score.teamName) ?? '',
      totalPoints: score.totalPoints,
    }));

  const topPlayers = [...input.playerTotals]
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .slice(0, TOP_PLAYERS_LIMIT);

  const champion = standings[0] ?? { teamName: '', ownerUid: '', totalPoints: 0 };

  return {
    seasonId: input.seasonId,
    endedAt: input.endedAt,
    endedBy: input.endedBy,
    champion: { teamName: champion.teamName, ownerUid: champion.ownerUid, totalPoints: champion.totalPoints },
    standings,
    topPlayers,
    teamCount: standings.length,
  };
}
