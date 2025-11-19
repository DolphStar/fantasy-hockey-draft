import { useMemo } from 'react';
import type { RosterPerson } from '../utils/nhlApi';

export function useBestAvailable(allPlayers: RosterPerson[], draftedPlayerIds: Set<number>, lastSeasonStats: any) {
    return useMemo(() => {
        // Filter out drafted players
        const available = allPlayers.filter(p => !draftedPlayerIds.has(p.person.id));

        // Sort by points (descending)
        // We need to handle players with no stats (rookies/unknowns) by giving them -1
        const sorted = available.sort((a, b) => {
            const statsA = lastSeasonStats[a.person.id];
            const statsB = lastSeasonStats[b.person.id];

            const pointsA = statsA?.points || 0;
            const pointsB = statsB?.points || 0;

            // For goalies, we might want to use wins or save percentage, but for now let's stick to points/wins mix or just default sort
            // If both are goalies, compare wins
            if (a.position.code === 'G' && b.position.code === 'G') {
                const winsA = statsA?.wins || 0;
                const winsB = statsB?.wins || 0;
                return winsB - winsA;
            }

            return pointsB - pointsA;
        });

        // Return top 5 overall, and top 3 per position group
        return {
            overall: sorted.slice(0, 5),
            forwards: sorted.filter(p => ['C', 'L', 'R'].includes(p.position.code)).slice(0, 5),
            defense: sorted.filter(p => p.position.code === 'D').slice(0, 5),
            goalies: sorted.filter(p => p.position.code === 'G').slice(0, 5)
        };
    }, [allPlayers, draftedPlayerIds, lastSeasonStats]);
}
