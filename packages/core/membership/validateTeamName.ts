/**
 * Team names double as Firestore document IDs (`teamScores/{teamName}`,
 * `aggregates/{teamName}`), so doc-ID-unsafe names would break a league's
 * nightly scoring. Blocklist (not allowlist) so unicode/emoji names stay legal.
 */

export const TEAM_NAME_MAX_LENGTH = 40;

export type TeamNameValidation =
  | { ok: true; teamName: string }
  | { ok: false; error: string };

export function validateTeamName(raw: unknown): TeamNameValidation {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'A team name is required' };
  }
  const teamName = raw.trim();
  if (!teamName) {
    return { ok: false, error: 'A team name is required' };
  }
  if (teamName.length > TEAM_NAME_MAX_LENGTH) {
    return { ok: false, error: `Team name is too long (max ${TEAM_NAME_MAX_LENGTH} characters)` };
  }
  if (teamName.includes('/')) {
    return { ok: false, error: 'Team name cannot contain "/"' };
  }
  if (teamName === '.' || teamName === '..' || /^__.*__$/.test(teamName)) {
    return { ok: false, error: 'That team name is reserved' };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(teamName)) {
    return { ok: false, error: 'Team name contains invalid characters' };
  }
  return { ok: true, teamName };
}
