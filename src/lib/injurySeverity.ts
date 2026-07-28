import type { InjuryReport } from '../services/injuryService';

/**
 * Ordering an injury list by how much it hurts you.
 *
 * The list used to be grouped alphabetically by franchise, which buries the
 * players you'd actually act on under whichever teams start with A. What a GM
 * scanning this page wants is the opposite: who is most unavailable, and for
 * longest.
 *
 * Lower rank = worse. Suspensions sit below every injury: they're a different
 * kind of absence and they end on a known date.
 */
const SEVERITY: Record<string, number> = {
    'injured reserve': 0,
    out: 1,
    doubtful: 2,
    questionable: 3,
    'day-to-day': 4,
    suspension: 5,
};

/** Unknown statuses sort after everything known rather than jumping the queue. */
const UNKNOWN_SEVERITY = 90;

export function severityRank(status: string | undefined): number {
    if (!status) return UNKNOWN_SEVERITY;
    return SEVERITY[status.trim().toLowerCase()] ?? UNKNOWN_SEVERITY;
}

/**
 * Milliseconds until a player is back. Missing or unparseable dates return
 * `-Infinity` so they sort *after* players with a known long absence — an
 * unknown return is not evidence of a long one.
 */
export function outUntil(injury: Pick<InjuryReport, 'returnDate'>): number {
    if (!injury.returnDate) return -Infinity;
    const parsed = Date.parse(injury.returnDate);
    return Number.isNaN(parsed) ? -Infinity : parsed;
}

/**
 * Worst first, then out-longest, then by name so the order is total and doesn't
 * reshuffle between renders.
 */
export function compareBySeverity(a: InjuryReport, b: InjuryReport): number {
    const bySeverity = severityRank(a.status) - severityRank(b.status);
    if (bySeverity !== 0) return bySeverity;

    const byReturn = outUntil(b) - outUntil(a);
    if (byReturn !== 0 && Number.isFinite(byReturn)) return byReturn;
    // Both unknown (or equal) return dates — fall through to the name.

    return (a.playerName || '').localeCompare(b.playerName || '');
}

/** Non-mutating sort; the injuries array is shared query cache. */
export function sortBySeverity(injuries: InjuryReport[]): InjuryReport[] {
    return [...injuries].sort(compareBySeverity);
}
