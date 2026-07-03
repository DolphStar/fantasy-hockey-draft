import { randomInt } from 'node:crypto';

/** Unambiguous url-safe alphabet (no 0/O/1/I/L). */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a random invite code. Uses crypto.randomInt (unbiased CSPRNG) —
 * invite codes are the only gate to joining a private league, so Math.random
 * is not acceptable here. `randInt` is injectable for deterministic tests.
 */
export function generateInviteCode(
  length = 8,
  randInt: (maxExclusive: number) => number = randomInt,
): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_ALPHABET[randInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
