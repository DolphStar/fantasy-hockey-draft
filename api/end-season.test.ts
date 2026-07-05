import { describe, expect, it, vi } from 'vitest';

import handler from './end-season';

function mockRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('POST /api/end-season input validation', () => {
  it('rejects a missing leagueId with 400', async () => {
    const res = mockRes();
    await handler({ body: {}, headers: {} } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an unknown action with 400', async () => {
    const res = mockRes();
    await handler({ body: { leagueId: 'L1', action: 'explode' }, headers: {} } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
