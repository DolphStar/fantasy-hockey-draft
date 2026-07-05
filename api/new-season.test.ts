import { describe, expect, it, vi } from 'vitest';

import handler from './new-season';

describe('POST /api/new-season input validation', () => {
  it('rejects a missing leagueId with 400', async () => {
    const res: Record<string, unknown> = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    await handler({ body: {}, headers: {} } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
