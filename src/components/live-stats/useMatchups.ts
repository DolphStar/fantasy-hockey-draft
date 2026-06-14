import { useEffect, useState } from 'react';

import { useLeague } from '../../context/LeagueContext';
import { fetchDraftedPlayers } from '../../services/draftedPlayersService';
import { fetchScheduleForDate, getUpcomingMatchups, type PlayerMatchup } from '../../utils/nhlSchedule';

/** Loads the current user's active-roster matchups for the selected date. */
export function useMatchups({ selectedDate }: { selectedDate: string }) {
  const { league, myTeam } = useLeague();
  const [upcomingMatchups, setUpcomingMatchups] = useState<PlayerMatchup[]>([]);

  useEffect(() => {
    if (!league || !myTeam) return;

    const fetchMatchups = async () => {
      try {
        const allowedGameTypes = league.allowedGameTypes && league.allowedGameTypes.length > 0
          ? league.allowedGameTypes
          : [2]; // Default: regular season only
        const games = await fetchScheduleForDate(selectedDate, allowedGameTypes);
        const roster = (await fetchDraftedPlayers(league.id, {
          teamName: myTeam.teamName,
          activeOnly: true,
        })).map((player) => ({
          playerId: Number(player.playerId),
          name: player.name,
          nhlTeam: player.nhlTeam,
        }));

        console.log(`📊 Matchups: Found ${roster.length} active players for ${selectedDate}`);

        // Get matchups for your roster
        const matchups = getUpcomingMatchups(roster, games);
        setUpcomingMatchups(matchups);
      } catch (error) {
        console.error('Error fetching matchups:', error);
      }
    };

    fetchMatchups();
  }, [league, myTeam, selectedDate]);

  return upcomingMatchups;
}
