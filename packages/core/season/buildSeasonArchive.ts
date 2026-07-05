import { buildSeasonAwards } from './buildSeasonAwards.js';
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
    round?: number;
    pickNumber?: number;
    bestDay?: { date: string; points: number } | null;
  }>;
}

const TOP_PLAYERS_LIMIT = 10;

/** Pure: final standings + champion + top players + awards from season aggregates. */
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
    .slice(0, TOP_PLAYERS_LIMIT)
    .map((p) => ({
      playerId: p.playerId,
      name: p.name,
      position: p.position,
      nhlTeam: p.nhlTeam,
      points: p.points,
      draftedByTeam: p.draftedByTeam,
    }));

  const champion = standings[0] ?? { teamName: '', ownerUid: '', totalPoints: 0 };

  const { awards, stats, teamSummaries } = buildSeasonAwards(input.playerTotals, standings, standings.length);

  return {
    seasonId: input.seasonId,
    endedAt: input.endedAt,
    endedBy: input.endedBy,
    champion: { teamName: champion.teamName, ownerUid: champion.ownerUid, totalPoints: champion.totalPoints },
    standings,
    topPlayers,
    teamCount: standings.length,
    awards,
    stats,
    teamSummaries,
  };
}
