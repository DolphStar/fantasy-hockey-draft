import { describe, expect, it } from 'vitest';

import { validateTeamName } from './validateTeamName.js';

describe('validateTeamName', () => {
  it('accepts a normal name and trims it', () => {
    expect(validateTeamName('  Ice Breakers  ')).toEqual({ ok: true, teamName: 'Ice Breakers' });
  });

  it('accepts unicode and emoji (legacy names stay legal)', () => {
    expect(validateTeamName('Les Habitants 🏒')).toEqual({ ok: true, teamName: 'Les Habitants 🏒' });
  });

  it('rejects non-strings and empty/whitespace-only names', () => {
    expect(validateTeamName(undefined).ok).toBe(false);
    expect(validateTeamName(42).ok).toBe(false);
    expect(validateTeamName('').ok).toBe(false);
    expect(validateTeamName('   ').ok).toBe(false);
  });

  it('rejects names longer than 40 characters', () => {
    expect(validateTeamName('x'.repeat(41)).ok).toBe(false);
    expect(validateTeamName('x'.repeat(40)).ok).toBe(true);
  });

  it('rejects doc-ID-unsafe names (slash, dot names, dunder, control chars)', () => {
    expect(validateTeamName('a/b').ok).toBe(false);
    expect(validateTeamName('.').ok).toBe(false);
    expect(validateTeamName('..').ok).toBe(false);
    expect(validateTeamName('__team__').ok).toBe(false);
    expect(validateTeamName('bad\tname').ok).toBe(false);
  });
});
