/**
 * Season-scale parity tests against a REAL completed pool scored by a different
 * engine: "Esports Hockey" on hockeydraft.ca, 2025-26 (captured 2026-07-24).
 *
 * `api/_lib/nhl/realContract.test.ts` proves we read one NHL boxscore correctly.
 * This file proves the other half: that our rule interpretation, position gating
 * and roster handling produce the same season numbers a long-running commercial
 * pool produced from the same stat lines and the same published rule sheet.
 *
 * The oracle is hockeydraft.ca's Draft Recap page, which scores each player's
 * FULL-SEASON stat line independently of roster history -- 143 player-seasons,
 * each an independent assertion. See the fixture header for why the Pool Stats
 * page's point column is NOT a valid oracle.
 */
import { describe, expect, it } from 'vitest';

import {
  ACTIVE_ROSTER_SIZE,
  CONTROL_TEAM,
  HOCKEYDRAFT_DRAFT_RECAP,
  HOCKEYDRAFT_FINAL_ROSTERS,
  HOCKEYDRAFT_STANDINGS,
  HOCKEYDRAFT_TRANSACTIONS,
  ROSTER_SHAPE,
  toPlayerGameStats,
  toPublishedPrecision,
  type HockeyDraftStatLine,
} from '../../../packages/core/scoring/__fixtures__/hockeydraft-2025-26';
import { aggregateDailyScores } from '../../../packages/core/scoring/aggregateDailyScores';
import { DEFAULT_SCORING_RULES } from '../../../packages/core/scoring/defaults';
import { calculatePlayerPoints } from '../../../packages/core/scoring/scoringMath';
import { buildActivePlayerToTeamMap } from './helpers';

const TEAMS = [...new Set(HOCKEYDRAFT_FINAL_ROSTERS.map((entry) => entry.team))].sort();

const score = (line: HockeyDraftStatLine) =>
  calculatePlayerPoints(toPlayerGameStats(line), DEFAULT_SCORING_RULES);

const recapPick = (name: string) => {
  const pick = HOCKEYDRAFT_DRAFT_RECAP.find((entry) => entry.name === name);
  if (!pick) throw new Error(`${name} is not in the draft recap fixture`);
  return pick;
};

const activeRoster = (team: string) =>
  HOCKEYDRAFT_FINAL_ROSTERS.filter((entry) => entry.team === team && entry.slot === 'active');

describe('hockeydraft.ca 2025-26 — scoring rule parity', () => {
  it('reproduces every published point total across all 143 drafted player-seasons', () => {
    const mismatches = HOCKEYDRAFT_DRAFT_RECAP.filter(
      (pick) => toPublishedPrecision(score(pick)) !== pick.publishedPoints,
    ).map(
      (pick) =>
        `${pick.name} (${pick.position}): ours ${score(pick)} -> ` +
        `${toPublishedPrecision(score(pick))}, theirs ${pick.publishedPoints}`,
    );

    expect(mismatches).toEqual([]);
    expect(HOCKEYDRAFT_DRAFT_RECAP).toHaveLength(143);
  });

  it('scores forwards on goals, assists and bonuses only — Ovechkin banks nothing for 134 hits', () => {
    const ovechkin = recapPick('Alex Ovechkin');
    expect([ovechkin.hits, ovechkin.blockedShots]).toEqual([134, 16]);
    // 32 G + 32 A, and not one point for 134 hits or 16 blocks.
    expect(score(ovechkin)).toBe(64);
    expect(score(ovechkin)).toBe(ovechkin.publishedPoints);
  });

  it('pays skater fights at 2 pts — Mathieu Olivier: 9 fights, 209 hits, still no hit credit', () => {
    const olivier = recapPick('Mathieu Olivier');
    // 15 G + 11 A + 9 fights x 2 = 44, with 209 hits and 42 blocks ignored.
    expect(score(olivier)).toBe(44);
    expect(score(olivier)).toBe(olivier.publishedPoints);
  });

  it('stacks SH and OT bonuses on top of the goal itself — Alex Tuch', () => {
    const tuch = recapPick('Alex Tuch');
    // 33 G + 33 A + 3 SHG + 1 OTG + 1 fight x 2 = 72
    expect(score(tuch)).toBe(72);
    expect(score(tuch)).toBe(tuch.publishedPoints);
  });

  it('pays defense 0.15 per block and 0.1 per hit — Moritz Seider', () => {
    const seider = recapPick('Moritz Seider');
    // 10 G + 50 A + 1 OTG + 1 fight x 2 + 180 x 0.15 + 128 x 0.1 = 102.8
    expect(score(seider)).toBeCloseTo(102.8, 10);
    expect(toPublishedPrecision(score(seider))).toBe(seider.publishedPoints);
  });

  it('pays goalies win 1 / shutout 2 / save 0.04 / assist 1 — Ilya Sorokin', () => {
    const sorokin = recapPick('Ilya Sorokin');
    // 29 W + 7 SO x 2 + 1383 saves x 0.04 + 1 assist = 99.32 -> 99.3
    expect(score(sorokin)).toBeCloseTo(99.32, 10);
    expect(toPublishedPrecision(score(sorokin))).toBe(sorokin.publishedPoints);
  });

  it('pays a goalie fight 5 pts, not the skater rate — Andrei Vasilevskiy', () => {
    const vasilevskiy = recapPick('Andrei Vasilevskiy');
    expect(vasilevskiy.fights).toBe(1);
    // 39 W + 2 SO x 2 + 1349 saves x 0.04 + 2 assists + 1 fight x 5 = 103.96 -> 104.0
    expect(score(vasilevskiy)).toBeCloseTo(103.96, 10);
    expect(toPublishedPrecision(score(vasilevskiy))).toBe(104);
    // At the skater rate this would be 100.96 -- the fixture distinguishes them.
    expect(toPublishedPrecision(score(vasilevskiy))).not.toBe(101);
  });

  it('gives an injured player who never dressed exactly zero — Aleksander Barkov', () => {
    const barkov = recapPick('Aleksander Barkov');
    expect(score(barkov)).toBe(0);
    expect(barkov.publishedPoints).toBe(0);
  });

  it('treats every non-D, non-G position string identically', () => {
    const mcdavid = toPlayerGameStats(recapPick('Connor McDavid'));
    const asCentre = calculatePlayerPoints({ ...mcdavid, position: 'C' }, DEFAULT_SCORING_RULES);

    for (const position of ['L', 'R', 'C', 'F']) {
      expect(
        calculatePlayerPoints({ ...mcdavid, position }, DEFAULT_SCORING_RULES),
      ).toBe(asCentre);
    }
  });
});

describe('hockeydraft.ca 2025-26 — rule coverage of the fixture', () => {
  const skaters = HOCKEYDRAFT_DRAFT_RECAP.filter((pick) => pick.position !== 'G');
  const defense = HOCKEYDRAFT_DRAFT_RECAP.filter((pick) => pick.position === 'D');
  const goalies = HOCKEYDRAFT_DRAFT_RECAP.filter((pick) => pick.position === 'G');
  const count = <T,>(rows: T[], predicate: (row: T) => boolean) => rows.filter(predicate).length;

  it('exercises 12 of the 13 configured scoring rules against real season data', () => {
    expect({
      goal: count(skaters, (p) => p.goals > 0),
      assist: count(skaters, (p) => p.assists > 0),
      shortHandedGoal: count(skaters, (p) => p.shortHandedGoals > 0),
      overtimeGoal: count(skaters, (p) => p.overtimeGoals > 0),
      fight: count(skaters, (p) => p.fights > 0),
      blockedShot: count(defense, (p) => p.blockedShots > 0),
      hit: count(defense, (p) => p.hits > 0),
      win: count(goalies, (p) => p.wins > 0),
      shutout: count(goalies, (p) => p.shutouts > 0),
      save: count(goalies, (p) => p.saves > 0),
      goalieAssist: count(goalies, (p) => p.assists > 0),
      goalieFight: count(goalies, (p) => p.fights > 0),
    }).toEqual({
      goal: 126,
      assist: 126,
      shortHandedGoal: 34,
      overtimeGoal: 65,
      fight: 41,
      blockedShot: 55,
      hit: 55,
      win: 16,
      shutout: 12,
      save: 16,
      goalieAssist: 10,
      goalieFight: 4,
    });
  });

  it('leaves goalieGoal unvalidated by real data — no goalie scored in 2025-26', () => {
    // Documents a real gap: the 20-pt rule has no external confirmation, so the
    // synthetic assertion below is the only thing pinning it down.
    expect(count(goalies, (p) => p.goals > 0)).toBe(0);

    const scoringGoalie = toPlayerGameStats({ ...recapPick('Ilya Sorokin'), goals: 1 });
    expect(calculatePlayerPoints(scoringGoalie, DEFAULT_SCORING_RULES)).toBeCloseTo(
      99.32 + 20,
      10,
    );
  });
});

describe('hockeydraft.ca 2025-26 — daily scoring must equal season scoring', () => {
  /** Split a season line into `days` daily lines that sum back to the original. */
  const splitIntoDays = (line: HockeyDraftStatLine, days: number): HockeyDraftStatLine[] => {
    const counters = [
      'goals',
      'assists',
      'shortHandedGoals',
      'overtimeGoals',
      'fights',
      'blockedShots',
      'hits',
      'wins',
      'shutouts',
      'saves',
    ] as const;

    return Array.from({ length: days }, (_, day) => {
      const slice = { ...line };
      for (const key of counters) {
        const total = line[key];
        const base = Math.floor(total / days);
        slice[key] = base + (day < total % days ? 1 : 0);
      }
      return slice;
    });
  };

  /**
   * The whole comparison rests on this: our engine scores day by day, the oracle
   * scores one season line. That is only equivalent because every rule is
   * count x weight with per-player (not per-game) position gating, so the scoring
   * function is linear in the stats. If a non-linear rule is ever added -- a
   * hat-trick bonus, a per-game cap -- this test fails first and the parity suite
   * above stops being meaningful.
   */
  it.each([
    ['Moritz Seider', 82],
    ['Ilya Sorokin', 60],
    ['Mathieu Olivier', 77],
    ['Connor McDavid', 82],
  ])('scores %s the same split across %i days as in one season line', (name, days) => {
    const line = recapPick(name);
    const daily = splitIntoDays(line, days);

    for (const key of ['goals', 'assists', 'blockedShots', 'hits', 'saves'] as const) {
      expect(daily.reduce((sum, day) => sum + day[key], 0)).toBe(line[key]);
    }

    const summed = daily.reduce((total, day) => total + score(day), 0);
    expect(summed).toBeCloseTo(score(line), 8);
  });
});

describe('hockeydraft.ca 2025-26 — roster handling', () => {
  it('every team finished with exactly 9 F / 6 D / 2 G active plus 5 reserves', () => {
    expect(TEAMS).toEqual(['Colin', 'Kieran', 'Nick', 'Patrick', 'Tay']);

    for (const team of TEAMS) {
      const active = activeRoster(team);
      const reserves = HOCKEYDRAFT_FINAL_ROSTERS.filter(
        (entry) => entry.team === team && entry.slot === 'reserve',
      );

      expect({
        team,
        forwards: active.filter((entry) => entry.position === 'F').length,
        defense: active.filter((entry) => entry.position === 'D').length,
        goalies: active.filter((entry) => entry.position === 'G').length,
        reserves: reserves.length,
      }).toEqual({
        team,
        forwards: ROSTER_SHAPE.forwards,
        defense: ROSTER_SHAPE.defense,
        goalies: ROSTER_SHAPE.goalies,
        reserves: ROSTER_SHAPE.reserves,
      });
      expect(active).toHaveLength(ACTIVE_ROSTER_SIZE);
    }
  });

  it('buildActivePlayerToTeamMap keeps the 85 active players and benches the 25 reserves', () => {
    const { playerToTeamMap, reserveCount } = buildActivePlayerToTeamMap(
      HOCKEYDRAFT_FINAL_ROSTERS.map((entry) => ({
        playerId: entry.hdPlayerId,
        rosterSlot: entry.slot,
        draftedByTeam: entry.team,
      })),
    );

    expect(playerToTeamMap.size).toBe(TEAMS.length * ACTIVE_ROSTER_SIZE);
    expect(reserveCount).toBe(TEAMS.length * ROSTER_SHAPE.reserves);
    expect(playerToTeamMap.get(recapPick('Nathan MacKinnon').hdPlayerId)).toBe('Tay');
    // Sebastian Aho finished on Tay's bench: rostered, but not scoring.
    expect(playerToTeamMap.has(recapPick('Sebastian Aho').hdPlayerId)).toBe(false);
  });

  it('drops reserve production on the floor through the real aggregation path', () => {
    const { playerToTeamMap } = buildActivePlayerToTeamMap(
      HOCKEYDRAFT_FINAL_ROSTERS.map((entry) => ({
        playerId: entry.hdPlayerId,
        rosterSlot: entry.slot,
        draftedByTeam: entry.team,
      })),
    );

    const { teamPoints, playerScores } = aggregateDailyScores(
      [HOCKEYDRAFT_FINAL_ROSTERS.map(toPlayerGameStats)],
      playerToTeamMap,
      DEFAULT_SCORING_RULES,
      '2026-04-17',
    );

    // Aho put up 84 points of production that Tay's bench threw away.
    expect(playerScores.some((entry) => entry.playerName === 'Sebastian Aho')).toBe(false);
    expect(score(recapPick('Sebastian Aho'))).toBe(84);

    // Every scoring team total is exactly the sum of its active players.
    for (const team of TEAMS) {
      const expected = activeRoster(team).reduce((total, entry) => total + score(entry), 0);
      expect(teamPoints.get(team)).toBeCloseTo(expected, 8);
    }
  });
});

describe('hockeydraft.ca 2025-26 — season totals', () => {
  const published = (team: string) => {
    const row = HOCKEYDRAFT_STANDINGS.find((entry) => entry.team === team);
    if (!row) throw new Error(`${team} is not in the standings fixture`);
    return row.points;
  };

  it('confirms from the transaction log that only the control team stood pat', () => {
    const inSeasonMoves = Object.fromEntries(
      TEAMS.map((team) => [
        team,
        HOCKEYDRAFT_TRANSACTIONS.filter(
          (entry) => entry.team === team && !entry.endOfSeasonSnapshot,
        ).length,
      ]),
    );

    expect(inSeasonMoves).toEqual({
      Colin: 59,
      Kieran: 68,
      Nick: 49,
      Patrick: 76,
      Tay: 0,
    });
    expect(inSeasonMoves[CONTROL_TEAM]).toBe(0);
  });

  /**
   * The end-to-end check. Tay never touched their roster, so their 17 actives held
   * from opening night and their published season total must fall straight out of
   * our engine applied to those 17 season lines. Matching 1053.87 to the cent means
   * the rule set, the position gating, the reserve exclusion and the arithmetic all
   * agree with the reference engine over a full season.
   */
  it('reproduces the control team season total to the cent', () => {
    const total = activeRoster(CONTROL_TEAM).reduce((sum, entry) => sum + score(entry), 0);

    expect(total).toBeCloseTo(published(CONTROL_TEAM), 2);
    expect(total).toBeCloseTo(1053.87, 2);
  });

  it('cannot reproduce a team that transacted — and that is roster history, not scoring', () => {
    // Every other team's published total reflects who was ACTIVE on each date, which
    // needs day-by-day splits the site does not publish. Documented so a future
    // reader does not mistake this gap for a scoring bug.
    for (const team of TEAMS.filter((name) => name !== CONTROL_TEAM)) {
      const heldAllSeason = activeRoster(team).reduce((sum, entry) => sum + score(entry), 0);
      expect(heldAllSeason).not.toBeCloseTo(published(team), 2);
    }
  });

  /**
   * The counterfactual the parity work was commissioned to answer: same draft, same
   * final rosters, but scored by THIS project with no in-season roster churn. It is
   * a regression lock on the engine, and it shows what roster management was worth:
   * Colin and Patrick gained by benching cold players, Nick and Kieran lost ground.
   */
  it('produces these totals if every team had simply held its final roster', () => {
    const standings = TEAMS.map((team) => ({
      team,
      points: Number(
        activeRoster(team)
          .reduce((sum, entry) => sum + score(entry), 0)
          .toFixed(2),
      ),
    })).sort((a, b) => b.points - a.points);

    expect(standings).toEqual([
      { team: 'Patrick', points: 1526.26 },
      { team: 'Colin', points: 1479.68 },
      { team: 'Kieran', points: 1416.91 },
      { team: 'Nick', points: 1410.02 },
      { team: 'Tay', points: 1053.87 },
    ]);

    // Patrick still wins, but the order behind him is completely rearranged:
    // Colin climbs from 4th to 2nd and Nick falls from 2nd to 4th.
    expect(HOCKEYDRAFT_STANDINGS.map((entry) => entry.team)).toEqual([
      'Patrick',
      'Nick',
      'Kieran',
      'Colin',
      'Tay',
    ]);
  });
});
