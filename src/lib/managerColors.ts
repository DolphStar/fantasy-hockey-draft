import type { LeagueTeam } from '../types/league';

/**
 * Every manager in a league gets one colour, and it is the same colour
 * everywhere they appear — standings row, chat bubble, avatar tile, draft
 * column. In a five-person league the sender of a message and the team in
 * second place are the information; a name in white text is not.
 *
 * Assignment is by position in `league.teams`, which is a stored array and so
 * stable for the life of the league. Never key off a sorted view (standings are
 * ordered by points) or a manager's colour would change when they move up.
 */

/** Ordered so adjacent managers stay distinguishable at a 4px edge. */
export const MANAGER_ACCENTS = [
    '#22c55e', // emerald
    '#3b82f6', // blue
    '#f97316', // orange
    '#ec4899', // pink
    '#a855f7', // violet
    '#0ea5e9', // sky
    '#facc15', // amber
    '#14b8a6', // teal
] as const;

/** Colour for the nth team in a league's stored team order. */
export function managerAccentAt(index: number): string {
    if (!Number.isFinite(index) || index < 0) return MANAGER_ACCENTS[0];
    return MANAGER_ACCENTS[index % MANAGER_ACCENTS.length];
}

/** Stable index for a name the league's team list doesn't contain. */
function hashToAccentIndex(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return Math.abs(hash) % MANAGER_ACCENTS.length;
}

/**
 * Colour for a named team.
 *
 * A name the league doesn't know about — someone who left, a legacy chat
 * message written before teams were renamed — is hashed rather than defaulted.
 * Defaulting to the first accent made every unknown sender share a colour with
 * whoever happens to sit at index 0, which is worse than no colour at all.
 */
export function managerAccent(teams: readonly LeagueTeam[] | undefined, teamName: string | null | undefined): string {
    if (!teamName) return MANAGER_ACCENTS[0];
    const index = teams?.findIndex((t) => t.teamName === teamName) ?? -1;
    return index >= 0 ? managerAccentAt(index) : MANAGER_ACCENTS[hashToAccentIndex(teamName)];
}

/** `rgba()` form of a manager accent, for tints and glows. */
export function accentAlpha(hex: string, alpha: number): string {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
    const int = Number.parseInt(full, 16);
    if (!Number.isFinite(int)) return hex;
    return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}
