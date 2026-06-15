import { describe, expect, it, vi } from 'vitest';

import { applyRosterSwaps, type RosterSwapDeps } from './applyRosterSwaps';

const SATURDAY = new Date('2026-06-13T12:00:00Z'); // a Saturday
const FRIDAY = new Date('2026-06-12T12:00:00Z');

describe('applyRosterSwaps', () => {
  it('does nothing and never reads players when it is not Saturday', async () => {
    const deps: RosterSwapDeps = { getLeaguePlayers: vi.fn() };
    const result = await applyRosterSwaps('L1', FRIDAY, deps);
    expect(result.swapsApplied).toBe(0);
    expect(deps.getLeaguePlayers).not.toHaveBeenCalled();
  });

  it('reads players scoped to the league and applies only pending swaps', async () => {
    const update = vi.fn(async () => {});
    const noop = vi.fn(async () => {});
    const deps: RosterSwapDeps = {
      getLeaguePlayers: vi.fn(async () => [
        { name: 'A', pendingSlot: 'active', update },
        { name: 'B', pendingSlot: null, update: noop },
      ]),
    };

    const result = await applyRosterSwaps('L1', SATURDAY, deps);

    expect(deps.getLeaguePlayers).toHaveBeenCalledWith('L1');
    expect(result.swapsApplied).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ rosterSlot: 'active', pendingSlot: null }),
    );
    expect(noop).not.toHaveBeenCalled();
  });
});
