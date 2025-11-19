import { useMemo } from 'react';
import { useLeague } from '../context/LeagueContext';
import { useDraft } from '../context/DraftContext';
import type { RosterPerson } from '../utils/nhlApi';

export function usePositionScarcity(allPlayers: RosterPerson[], draftedPlayerIds: Set<number>) {
    const { league } = useLeague();
    const { draftState } = useDraft();

    return useMemo(() => {
        if (!league || !draftState) return null;

        // 1. Count remaining players by position (tier-based logic could be added later)
        const remainingCounts = {
            C: 0, L: 0, R: 0, D: 0, G: 0
        };

        // 2. Count total spots needed by position across the league
        // Assuming standard roster settings if not defined
        const settings = league.rosterSettings || { forwards: 9, defensemen: 5, goalies: 2 };
        const totalTeams = league.teams.length;

        // Total starters needed in the league
        const totalNeeded = {
            F: totalTeams * settings.forwards, // Simplified: C+L+R combined for now or split if settings allow
            D: totalTeams * settings.defensemen,
            G: totalTeams * settings.goalies
        };

        // 3. Count how many have been drafted so far
        // We would need to iterate through drafted players to know exact counts, 
        // but for now we can estimate or use what we have if we passed in drafted players list.
        // For this hook, let's focus on "Remaining High Value Players" as a proxy for scarcity.

        // Filter undrafted players
        const undrafted = allPlayers.filter(p => !draftedPlayerIds.has(p.person.id));

        undrafted.forEach(p => {
            if (p.position.code in remainingCounts) {
                remainingCounts[p.position.code as keyof typeof remainingCounts]++;
            }
        });

        // Calculate "Scarcity Score" (Lower count = Higher scarcity)
        // This is a simple implementation. A real one would look at VORP (Value Over Replacement Player).

        return {
            remainingCounts,
            totalNeeded
        };

    }, [allPlayers, draftedPlayerIds, league, draftState]);
}
