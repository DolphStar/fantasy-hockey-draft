/**
 * Selection rule for the two-player comparison tray.
 *
 * Kept pure and separate from ComparisonContext so the behaviour is testable
 * without a DOM: clicking Compare toggles, a third pick replaces the
 * challenger, and slot 1 stays put as the anchor you compare against.
 */
export function nextComparisonSelection<T extends { id: number }>(
    current: readonly T[],
    player: T,
): T[] {
    if (current.some(p => p.id === player.id)) {
        return current.filter(p => p.id !== player.id);
    }

    if (current.length >= 2) {
        return [current[0], player];
    }

    return [...current, player];
}

/** The comparison view is only meaningful once two players are picked. */
export const COMPARISON_SLOTS = 2;

export const isComparisonReady = (selected: readonly unknown[]) =>
    selected.length === COMPARISON_SLOTS;
