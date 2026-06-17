import { describe, expect, it } from 'vitest';

import { INVITE_CODE_ALPHABET, generateInviteCode } from './inviteCode';

describe('generateInviteCode', () => {
  it('produces a code of the requested length from the safe alphabet', () => {
    const code = generateInviteCode(8, () => 0);
    expect(code).toHaveLength(8);
    expect([...code].every((c) => INVITE_CODE_ALPHABET.includes(c))).toBe(true);
  });
  it('maps the random source across the alphabet deterministically', () => {
    expect(generateInviteCode(3, () => 0)).toBe(INVITE_CODE_ALPHABET[0].repeat(3));
  });
  it('defaults to length 8', () => {
    expect(generateInviteCode(undefined, () => 0)).toHaveLength(8);
  });
});
