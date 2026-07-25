import { describe, expect, it } from 'vitest';

import {
  createInitialDraftState,
  generateSnakeDraftOrder,
  getCurrentPick,
  getNextPick,
  isTeamsTurn,
  type DraftTeam,
} from './draftLogic';

const TEAMS: DraftTeam[] = [
  { teamName: 'Nick', ownerUid: 'uid-nick' },
  { teamName: 'Kieran', ownerUid: 'uid-kieran' },
  { teamName: 'Patrick', ownerUid: 'uid-patrick' },
];

describe('generateSnakeDraftOrder', () => {
  it('reverses team order on even rounds', () => {
    const order = generateSnakeDraftOrder(TEAMS, 3);

    expect(order.map((pick) => pick.team)).toEqual([
      'Nick', 'Kieran', 'Patrick',
      'Patrick', 'Kieran', 'Nick',
      'Nick', 'Kieran', 'Patrick',
    ]);
    expect(order.map((pick) => pick.pick)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(order.map((pick) => pick.round)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });

  it('does not mutate the caller’s team list while snaking', () => {
    const teams = [...TEAMS];
    generateSnakeDraftOrder(teams, 4);

    expect(teams).toEqual(TEAMS);
  });

  it('stamps every pick with the owning uid — the field the rules check', () => {
    const ownerByTeam = new Map(TEAMS.map((team) => [team.teamName, team.ownerUid]));

    for (const pick of generateSnakeDraftOrder(TEAMS, 4)) {
      expect(pick.ownerUid).toBe(ownerByTeam.get(pick.team));
    }
  });

  it('leaves unclaimed team slots with an empty uid so only the admin can draft for them', () => {
    const order = generateSnakeDraftOrder(
      [{ teamName: 'Nick', ownerUid: 'uid-nick' }, { teamName: 'Open Slot', ownerUid: '' }],
      2,
    );

    expect(order.filter((pick) => pick.team === 'Open Slot').map((pick) => pick.ownerUid))
      .toEqual(['', '']);
    // Never undefined: the rules compare this against request.auth.uid.
    expect(order.every((pick) => typeof pick.ownerUid === 'string')).toBe(true);
  });

  it('defends against a team record arriving without an owner uid at runtime', () => {
    const order = generateSnakeDraftOrder(
      [{ teamName: 'Legacy' } as DraftTeam],
      1,
    );

    expect(order[0].ownerUid).toBe('');
  });
});

describe('createInitialDraftState', () => {
  /**
   * These are exactly the conditions `isPristineDraft()` enforces in
   * firestore.rules for `drafts/{leagueId}`. If this shape ever drifts, every
   * draft create and every admin reset starts failing with permission-denied.
   */
  it('produces a state the Firestore pristine-draft rule will accept', () => {
    const state = createInitialDraftState(TEAMS, 22);

    expect(state.currentPickNumber).toBe(1);
    expect(state.isComplete).toBe(false);
    expect(Array.isArray(state.draftOrder)).toBe(true);
    expect(state.draftOrder.length).toBeGreaterThan(0);
    expect(state.totalPicks).toBe(state.draftOrder.length);
    expect(state.totalPicks).toBe(TEAMS.length * 22);
  });
});

describe('turn order', () => {
  it('puts the right manager on the clock at every pick of a full snake draft', () => {
    const state = createInitialDraftState(TEAMS, 22);
    const seen: string[] = [];

    for (let pickNumber = 1; pickNumber <= state.totalPicks; pickNumber++) {
      const onTheClock = { ...state, currentPickNumber: pickNumber };
      const pick = getCurrentPick(onTheClock);

      expect(pick).not.toBeNull();
      expect(isTeamsTurn(onTheClock, pick!.team)).toBe(true);

      // The rules read draftOrder[currentPickNumber - 1].ownerUid; assert that
      // index resolves to the same manager the UI puts on the clock.
      expect(onTheClock.draftOrder[pickNumber - 1].ownerUid).toBe(pick!.ownerUid);
      seen.push(pick!.ownerUid);

      for (const other of TEAMS.filter((team) => team.teamName !== pick!.team)) {
        expect(isTeamsTurn(onTheClock, other.teamName)).toBe(false);
      }
    }

    // Everyone gets exactly the same number of picks.
    for (const team of TEAMS) {
      expect(seen.filter((uid) => uid === team.ownerUid)).toHaveLength(22);
    }
  });

  it('reports no current or next pick once the draft runs out', () => {
    const state = createInitialDraftState(TEAMS, 2);

    expect(getCurrentPick({ ...state, currentPickNumber: state.totalPicks + 1 })).toBeNull();
    expect(getNextPick({ ...state, currentPickNumber: state.totalPicks })).toBeNull();
    expect(getNextPick({ ...state, currentPickNumber: 1 })?.pick).toBe(2);
  });
});
