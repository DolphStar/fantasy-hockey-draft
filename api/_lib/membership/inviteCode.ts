/** Unambiguous url-safe alphabet (no 0/O/1/I/L). */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Generate a random invite code. `rand` is injectable for deterministic tests. */
export function generateInviteCode(length = 8, rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_ALPHABET[Math.floor(rand() * INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
