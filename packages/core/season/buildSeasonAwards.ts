import type { AwardPlayer, SeasonAwards, SeasonStats, TeamSummary } from './types.js';

export interface AwardPlayerInput {
  playerId: number;
  name: string;
  position: string;
  nhlTeam: string;
  points: number;
  draftedByTeam: string;
  round?: number;
  pickNumber?: number;
  bestDay?: { date: string; points: number } | null;
}

export interface StandingRow {
  rank: number;
  teamName: string;
  ownerUid: string;
  totalPoints: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const byPointsThenName = (a: AwardPlayerInput, b: AwardPlayerInput) =>
  b.points - a.points || a.name.localeCompare(b.name);
const byRatioThenName = (a: AwardPlayerInput, b: AwardPlayerInput) =>
  b.points / b.pickNumber! - a.points / a.pickNumber! || a.name.localeCompare(b.name);

const toAward = (p: AwardPlayerInput): AwardPlayer => ({
  playerId: p.playerId,
  name: p.name,
  position: p.position,
  nhlTeam: p.nhlTeam,
  points: p.points,
  draftedByTeam: p.draftedByTeam,
});

export function buildSeasonAwards(
  players: AwardPlayerInput[],
  standings: StandingRow[],
  teamCount: number,
): { awards: SeasonAwards; stats: SeasonStats; teamSummaries: TeamSummary[] } {
  const drafted = players.filter((p) => typeof p.pickNumber === 'number');

  const mvp = players.length ? toAward([...players].sort(byPointsThenName)[0]) : null;

  const goalies = players.filter((p) => p.position === 'G');
  const topGoalie = goalies.length ? toAward([...goalies].sort(byPointsThenName)[0]) : null;

  const stealPool = drafted.filter((p) => p.points > 0);
  const bestSteal = stealPool.length ? toAward([...stealPool].sort(byRatioThenName)[0]) : null;

  let biggestBust: AwardPlayer | null = null;
  if (drafted.length >= 3) {
    const maxPick = Math.max(...drafted.map((p) => p.pickNumber!));
    const threshold = Math.ceil(maxPick / 3);
    const early = drafted.filter((p) => p.pickNumber! <= threshold);
    if (early.length) {
      biggestBust = toAward(
        [...early].sort((a, b) => a.points - b.points || a.name.localeCompare(b.name))[0],
      );
    }
  }

  const nightPool = players.filter((p) => p.bestDay);
  let biggestNight: SeasonAwards['biggestNight'] = null;
  if (nightPool.length) {
    const top = [...nightPool].sort(
      (a, b) => b.bestDay!.points - a.bestDay!.points || a.name.localeCompare(b.name),
    )[0];
    biggestNight = {
      playerId: top.playerId,
      name: top.name,
      draftedByTeam: top.draftedByTeam,
      date: top.bestDay!.date,
      points: top.bestDay!.points,
    };
  }

  const totalPoints = round1(standings.reduce((sum, s) => sum + s.totalPoints, 0));
  const avgTeamPoints = teamCount ? round1(totalPoints / teamCount) : 0;
  const runnerUpGap =
    standings.length >= 2 ? round1(standings[0].totalPoints - standings[1].totalPoints) : 0;

  const teamSummaries: TeamSummary[] = standings.map((row) => {
    const teamPlayers = players.filter((p) => p.draftedByTeam === row.teamName);
    const top = teamPlayers.length ? [...teamPlayers].sort(byPointsThenName)[0] : null;
    const picks = teamPlayers.filter((p) => typeof p.pickNumber === 'number' && p.points > 0);
    const best = picks.length ? [...picks].sort(byRatioThenName)[0] : null;
    return {
      teamName: row.teamName,
      ownerUid: row.ownerUid,
      rank: row.rank,
      totalPoints: row.totalPoints,
      topPlayer: top ? { name: top.name, points: top.points } : null,
      bestPick: best ? { name: best.name, round: best.round ?? 0, points: best.points } : null,
    };
  });

  return {
    awards: { mvp, bestSteal, biggestBust, topGoalie, biggestNight },
    stats: { totalPoints, avgTeamPoints, runnerUpGap },
    teamSummaries,
  };
}
