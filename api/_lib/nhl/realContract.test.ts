/**
 * Contract tests against REAL (trimmed) NHL API responses. These exist because
 * the scoring bug fixed in 2026-07 went unnoticed for a season: unit tests
 * fabricated `wins`/`shutouts` fields the real boxscore does not have.
 * If the NHL API shape changes, these fixtures + tests are the tripwire.
 */
import { describe, expect, it } from 'vitest';

import boxscoreFixture from './fixtures/boxscore-2025020947.json';
import landingFixture from './fixtures/landing-2025020947.json';

import { DEFAULT_SCORING_RULES } from '../../../packages/core/scoring/defaults';
import { calculatePlayerPoints } from '../../../packages/core/scoring/scoringMath';
import { parseGoalEvents } from '../../../packages/core/nhl/parseGoalEvents';
import { applyDerivedStats } from '../scoring/fetchDailyGameStats';
import { getAllPlayersFromBoxscore, type NhlBoxscore } from './webClient';

const players = () => {
  const list = getAllPlayersFromBoxscore(boxscoreFixture as unknown as NhlBoxscore);
  applyDerivedStats(list, new Map(), parseGoalEvents(landingFixture));
  return list;
};

const byId = (id: number) => {
  const p = players().find((x) => x.playerId === id);
  if (!p) throw new Error(`player ${id} missing from fixture`);
  return p;
};

describe('real NHL boxscore contract', () => {
  it('raw goalie entries do NOT have wins/shutouts/goals/assists (the reason derivation exists)', () => {
    const rawGoalie = (boxscoreFixture as any).playerByGameStats.homeTeam.goalies[0];
    expect(rawGoalie).not.toHaveProperty('wins');
    expect(rawGoalie).not.toHaveProperty('shutouts');
    expect(rawGoalie).not.toHaveProperty('goals');
    expect(rawGoalie).not.toHaveProperty('assists');
    expect(rawGoalie).toHaveProperty('decision');
    expect(rawGoalie).toHaveProperty('goalsAgainst');
  });

  it('raw skater entries have sog, not shots, and no shortHandedGoals', () => {
    const rawSkater = (boxscoreFixture as any).playerByGameStats.homeTeam.forwards[0];
    expect(rawSkater).toHaveProperty('sog');
    expect(rawSkater).not.toHaveProperty('shots');
    expect(rawSkater).not.toHaveProperty('shortHandedGoals');
  });

  it('scores the winning shutout goalie: 1 win + shutout + 22 saves = 3.88', () => {
    // A. Silovs (PIT): decision W, 22 saves, 0 GA
    const silovs = byId(8481668);
    expect(silovs.wins).toBe(1);
    expect(silovs.shutouts).toBe(1);
    expect(calculatePlayerPoints(silovs, DEFAULT_SCORING_RULES)).toBeCloseTo(
      1 * 1 + 1 * 2 + 22 * 0.04, // 3.88
      10,
    );
  });

  it('scores the losing goalie on saves only: 17 saves = 0.68', () => {
    // A. Hill (VGK): decision L, 17 saves, 5 GA
    const hill = byId(8478499);
    expect(hill.wins).toBe(0);
    expect(hill.shutouts).toBe(0);
    expect(calculatePlayerPoints(hill, DEFAULT_SCORING_RULES)).toBeCloseTo(17 * 0.04, 10);
  });

  it('scores a skater with 1G 1A for 2 points', () => {
    // B. Rust (PIT): 1 goal (pp) + 1 assist (on Rakell's goal)
    const rust = byId(8475810);
    expect(calculatePlayerPoints(rust, DEFAULT_SCORING_RULES)).toBeCloseTo(2, 10);
  });
});
