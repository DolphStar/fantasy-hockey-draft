import { useState, useEffect, useMemo } from 'react';
import { useLeague } from '../context/LeagueContext';
import { subscribeDraftedPlayersByLeague } from '../services/draftedPlayersService';
import type { DraftedPlayer } from '../types/draftedPlayer';

export function useDraftedPlayers() {
    const { league, myTeam } = useLeague();
    const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!league) {
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeDraftedPlayersByLeague(
            league.id,
            (players) => {
                setDraftedPlayers(players);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching drafted players:", err);
                setLoading(false);
            },
        );

        return () => unsubscribe();
    }, [league]);

    const draftedPlayerIds = useMemo(() => {
        return new Set(draftedPlayers.map(p => p.playerId));
    }, [draftedPlayers]);

    const myRosterStats = useMemo(() => {
        if (!myTeam) return { F: 0, D: 0, G: 0, total: 0, reserve: 0 };

        let F = 0, D = 0, G = 0, reserve = 0;
        const myPlayers = draftedPlayers.filter(p => p.draftedByTeam === myTeam.teamName);

        myPlayers.forEach(p => {
            if (p.rosterSlot === 'reserve') {
                reserve++;
            } else {
                if (['C', 'L', 'R'].includes(p.position)) F++;
                else if (p.position === 'D') D++;
                else if (p.position === 'G') G++;
            }
        });

        return { F, D, G, total: myPlayers.length, reserve };
    }, [draftedPlayers, myTeam]);

    const recentActivity = useMemo(() => {
        // Return last 5 picks reversed
        return [...draftedPlayers].sort((a, b) => b.pickNumber - a.pickNumber).slice(0, 5);
    }, [draftedPlayers]);

    return {
        draftedPlayers,
        draftedPlayerIds,
        myRosterStats,
        recentActivity,
        loading
    };
}
