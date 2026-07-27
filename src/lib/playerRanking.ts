import { getPlayerFullName, type RosterPerson, type StatsMap } from '../utils/nhlApi';

/**
 * Ranking players by what they did last season.
 *
 * Skaters are measured in points and goalies in wins, because those are the
 * numbers each position is actually judged on. The two scales aren't
 * interchangeable — a 40-win goalie scores below a 90-point centre in a mixed
 * list — which is the right default for a scouting grid dominated by skaters,
 * and becomes exactly correct the moment you filter to Goalies.
 *
 * We deliberately do *not* try to convert this into league fantasy points:
 * `LastSeasonStats` has no hits, blocks or saves, so any such number would be a
 * guess wearing a precise-looking decimal.
 */

/** The single number a player is ranked on. Unknown players sort last, not first. */
export function lastSeasonValue(player: RosterPerson, stats: StatsMap): number {
    const line = stats[player.person.id];
    if (!line) return -1;
    if (player.position.code === 'G') return line.wins ?? -1;
    return line.points ?? -1;
}

/**
 * Comparator for "best available first".
 *
 * Ties break on name so the order is total and stable — `Array.sort` is
 * undefined behaviour with an inconsistent comparator, and a 701-player list
 * re-sorting differently between renders is a real way to lose a player you
 * were looking at.
 */
export function compareByLastSeason(stats: StatsMap) {
    return (a: RosterPerson, b: RosterPerson): number => {
        const diff = lastSeasonValue(b, stats) - lastSeasonValue(a, stats);
        if (diff !== 0) return diff;
        return getPlayerFullName(a).localeCompare(getPlayerFullName(b));
    };
}

/** Non-mutating sort — the source roster is shared state and must not be reordered in place. */
export function sortByLastSeason(players: RosterPerson[], stats: StatsMap): RosterPerson[] {
    return [...players].sort(compareByLastSeason(stats));
}
