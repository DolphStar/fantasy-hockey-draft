import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VirtuosoGrid } from 'react-virtuoso';
import { toast } from 'sonner';
import {
  getPlayerFullName,
  getAllPlayers,
  getTeamRoster,
  NHL_TEAMS,
  getLastSeasonStats,
  type RosterPerson,
  type TeamAbbrev,
  type StatsMap
} from '../utils/nhlApi';
import { db } from '../firebase';
import { collection, onSnapshot, runTransaction, doc } from 'firebase/firestore';
import { useDraft } from '../context/DraftContext';
import { useLeague } from '../context/LeagueContext';
import { useSound } from '../context/SoundContext';
import { isPlayerInjuredByName } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
import { useTeamRoster } from '../queries/useTeamRoster';
import PlayerCard from './roster/PlayerCard';
import RosterFilters from './roster/RosterFilters';
import DraftStatus from './draft/DraftStatus';
import BestAvailable from './draft/BestAvailable';

interface NHLRosterProps {
  initialSearchQuery?: string;
  onSearchQueryUsed?: () => void;
}

export default function NHLRoster({ initialSearchQuery = '', onSearchQueryUsed }: NHLRosterProps) {
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<Set<number>>(new Set());
  const [draftingPlayerId, setDraftingPlayerId] = useState<number | null>(null);
  const [myTeamPositions, setMyTeamPositions] = useState({
    active: { F: 0, D: 0, G: 0 },
    reserve: 0,
    total: 0
  });
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL'); // Default to all teams
  const [lastSeasonStats, setLastSeasonStats] = useState<StatsMap>({}); // Last season stats

  // League context for showing user's team
  const { myTeam, league } = useLeague();

  // Draft context
  const { draftState, currentPick, isMyTurn } = useDraft();
  const { playSound } = useSound();

  // Update search query when navigating from Dashboard with a player name
  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
      onSearchQueryUsed?.();
    }
  }, [initialSearchQuery, onSearchQueryUsed]);

  // React Query hooks - automatic caching and refetching!
  const { data: injuries = [] } = useInjuries();

  // Conditionally use different queries based on team filter
  const isFetchingAllTeams = teamFilter === 'ALL';

  // Only fetch single team when not fetching all teams
  const { data: singleTeamData, isLoading: singleTeamLoading, error: singleTeamError } = useTeamRoster(
    !isFetchingAllTeams ? (teamFilter as TeamAbbrev) : null
  );

  // Only fetch all teams when "ALL" is selected (enabled flag prevents unnecessary fetching)
  const { data: allTeamsData, isLoading: allTeamsLoading, error: allTeamsError } = useQuery({
    queryKey: ['rosters', 'all'],
    queryFn: async () => {
      console.log('🏒 Loading all NHL teams in parallel...');
      const startTime = Date.now();

      const teamPromises = (Object.keys(NHL_TEAMS) as TeamAbbrev[]).map(async (abbrev) => {
        try {
          const rosterData = await getTeamRoster(abbrev);
          const teamPlayers = getAllPlayers(rosterData);
          return teamPlayers.map(player => {
            (player as any).teamAbbrev = abbrev;
            return player;
          });
        } catch (err) {
          console.warn(`Failed to load ${abbrev}:`, err);
          return [];
        }
      });

      const results = await Promise.all(teamPromises);
      const allPlayers = results.flat();

      const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Loaded ${allPlayers.length} players from ${Object.keys(NHL_TEAMS).length} teams in ${loadTime}s`);

      return allPlayers;
    },
    enabled: isFetchingAllTeams, // Only run this query when ALL teams is selected
    staleTime: 15 * 60 * 1000,
  });

  // Extract roster based on which query is active
  const roster: RosterPerson[] = isFetchingAllTeams
    ? (allTeamsData || [])
    : singleTeamData
      ? getAllPlayers(singleTeamData).map(player => {
        (player as any).teamAbbrev = teamFilter;
        return player;
      })
      : [];

  const loading = isFetchingAllTeams ? allTeamsLoading : singleTeamLoading;
  const error = isFetchingAllTeams
    ? (allTeamsError ? (allTeamsError as Error).message : null)
    : (singleTeamError ? (singleTeamError as Error).message : null);

  // Fetch last season stats on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        console.log('📊 Loading last season stats...');
        const stats = await getLastSeasonStats();
        setLastSeasonStats(stats);
      } catch (err) {
        console.error('Failed to load last season stats:', err);
      }
    };
    loadStats();
  }, []);

  // Set up real-time listener for drafted players
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'draftedPlayers'), (snapshot) => {
      const draftedIds = new Set<number>();
      let activeForwards = 0, activeDefense = 0, activeGoalies = 0;
      let reserveCount = 0, myTotal = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        draftedIds.add(data.playerId);

        // Count positions for my team
        if (myTeam && data.draftedByTeam === myTeam.teamName) {
          myTotal++;
          const pos = data.position;
          const slot = data.rosterSlot || 'active';

          if (slot === 'reserve') {
            reserveCount++;
          } else {
            // Active roster
            if (['C', 'L', 'R'].includes(pos)) {
              activeForwards++;
            } else if (pos === 'D') {
              activeDefense++;
            } else if (pos === 'G') {
              activeGoalies++;
            }
          }
        }
      });

      setDraftedPlayerIds(draftedIds);
      setMyTeamPositions({
        active: { F: activeForwards, D: activeDefense, G: activeGoalies },
        reserve: reserveCount,
        total: myTotal
      });
    });

    return () => unsubscribe();
  }, [myTeam]);

  // Check if we can draft a player to active roster
  const canDraftToActive = (position: string): boolean => {
    if (!league?.rosterSettings) return true;

    const { F, D, G } = myTeamPositions.active;
    const { forwards, defensemen, goalies } = league.rosterSettings;

    if (['C', 'L', 'R'].includes(position)) {
      return F < forwards;
    } else if (position === 'D') {
      return D < defensemen;
    } else if (position === 'G') {
      return G < goalies;
    }

    return false;
  };

  // Check if we can add to reserves (max 5)
  const canDraftToReserve = (): boolean => {
    return myTeamPositions.reserve < 5;
  };

  // Draft a player to Firebase
  const onDraftPlayer = async (rosterPlayer: RosterPerson, forceReserve: boolean = false) => {
    if (!isMyTurn) {
      toast.error("It's not your turn!", {
        description: "Wait for your pick to come around."
      });
      return;
    }

    if (!currentPick) {
      toast.error('Draft is complete!', {
        description: "All picks have been made."
      });
      return;
    }

    if (!league || !myTeam) {
      toast.error('No league/team found', {
        description: 'Join a league with an assigned team before drafting.'
      });
      return;
    }

    try {
      setDraftingPlayerId(rosterPlayer.person.id);

      // Check if already drafted
      if (draftedPlayerIds.has(rosterPlayer.person.id)) {
        toast.error('Player already drafted!', {
          description: `${getPlayerFullName(rosterPlayer)} has already been selected.`
        });
        setDraftingPlayerId(null);
        return;
      }

      // Determine roster slot
      let rosterSlot: 'active' | 'reserve' = 'active';
      const canAddToActive = canDraftToActive(rosterPlayer.position.code);
      const canAddToReserves = canDraftToReserve();

      if (forceReserve) {
        // User confirmed adding to reserves
        if (!canAddToReserves) {
          toast.error('Reserve roster full!', {
            description: 'You have 5/5 reserves. Cannot draft more players.'
          });
          setDraftingPlayerId(null);
          return;
        }
        rosterSlot = 'reserve';
      } else if (!canAddToActive) {
        // Active position is full - AUTO-ADD to reserves (no popup!)
        if (canAddToReserves) {
          rosterSlot = 'reserve';
          // Show info toast that we're adding to reserves
          toast.info('Adding to reserves', {
            description: `Active ${rosterPlayer.position.name} roster is full. Adding to bench.`
          });
        } else {
          toast.error('Roster full!', {
            description: `Active ${rosterPlayer.position.name} roster and reserves (5/5) are both full!`
          });
          setDraftingPlayerId(null);
          return;
        }
      }

      // Transactionally draft player and advance pick
      const { pickInfo } = await runTransaction(db, async (transaction) => {
        const draftRef = doc(db, 'drafts', league.id);
        const draftSnap = await transaction.get(draftRef);

        if (!draftSnap.exists()) {
          throw new Error('Draft state missing');
        }

        const draftData = draftSnap.data();
        const pickIndex = draftData.currentPickNumber - 1;

        if (!draftData.draftOrder?.[pickIndex]) {
          throw new Error('Invalid draft state');
        }

        const pickInfo = draftData.draftOrder[pickIndex];

        if (pickInfo.team !== myTeam.teamName) {
          throw new Error('Pick already made or not your turn');
        }

        const draftedPlayerRef = doc(collection(db, 'draftedPlayers'));
        transaction.set(draftedPlayerRef, {
          playerId: rosterPlayer.person.id,
          name: getPlayerFullName(rosterPlayer),
          position: rosterPlayer.position.code,
          positionName: rosterPlayer.position.name,
          jerseyNumber: rosterPlayer.jerseyNumber,
          nhlTeam: (rosterPlayer as any).teamAbbrev || 'UNK',
          draftedByTeam: pickInfo.team,
          pickNumber: pickInfo.pick,
          round: pickInfo.round,
          leagueId: league.id,
          draftedAt: new Date().toISOString(),
          rosterSlot: rosterSlot
        });

        const nextPickNumber = draftData.currentPickNumber + 1;
        transaction.update(draftRef, {
          currentPickNumber: nextPickNumber,
          isComplete: nextPickNumber > draftData.totalPicks
        });

        return { pickInfo };
      });

      // Update local state
      setDraftedPlayerIds(prev => new Set(prev).add(rosterPlayer.person.id));

      // Show success toast
      toast.success(`Drafted ${getPlayerFullName(rosterPlayer)}!`, {
        description: `${rosterPlayer.position.code} • ${(rosterPlayer as any).teamAbbrev} • Pick #${pickInfo.pick} → ${rosterSlot === 'reserve' ? 'Reserves' : 'Active Roster'}`
      });

      // Play sound
      playSound('draft-pick');

      console.log(`${pickInfo.team} drafted: ${getPlayerFullName(rosterPlayer)} (Pick #${pickInfo.pick})`);
    } catch (error) {
      console.error('Error drafting player:', error);
      toast.error('Failed to draft player', {
        description: 'Something went wrong. Please try again.'
      });
    } finally {
      setDraftingPlayerId(null);
    }
  };

  // Filter roster based on search, position, and team
  const filteredRoster = roster.filter(player => {
    const playerName = getPlayerFullName(player).toLowerCase();
    const matchesSearch = searchQuery === '' || playerName.includes(searchQuery.toLowerCase());

    const matchesPosition = positionFilter === 'ALL' ||
      (positionFilter === 'F' && ['C', 'L', 'R'].includes(player.position.code)) ||
      (positionFilter === player.position.code);

    const matchesTeam = teamFilter === 'ALL' || (player as any).teamAbbrev === teamFilter;

    return matchesSearch && matchesPosition && matchesTeam;
  });

  // Use virtualization for large lists (>100 players)
  const useVirtualization = filteredRoster.length > 100;

  return (
    <div className="max-w-[1600px] mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">NHL Team Roster</h2>

      {/* Draft Status Banner */}
      <DraftStatus
        draftState={draftState}
        currentPick={currentPick}
        isMyTurn={isMyTurn}
        myTeam={myTeam}
        league={league}
        myTeamPositions={myTeamPositions}
      />

      {/* Best Available (includes Position Scarcity) */}
      {!loading && !error && (
        <BestAvailable
          allPlayers={roster}
          draftedPlayerIds={draftedPlayerIds}
          lastSeasonStats={lastSeasonStats}
          onDraft={onDraftPlayer}
          isMyTurn={isMyTurn}
        />
      )}

      {/* Search and Filters */}
      <RosterFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        positionFilter={positionFilter}
        setPositionFilter={setPositionFilter}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        loading={loading}
        totalCount={roster.length}
        filteredCount={filteredRoster.length}
      />

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 p-4 rounded-lg mb-6 text-center">
          <p className="text-red-200 font-semibold">Error loading roster:</p>
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Roster Grid */}
      {!loading && !error && (
        useVirtualization ? (
          <VirtuosoGrid
            style={{ height: '800px' }}
            totalCount={filteredRoster.length}
            data={filteredRoster}
            itemContent={(_index, player) => (
              <div className="p-2 h-full">
                <PlayerCard
                  player={player}
                  isDrafted={draftedPlayerIds.has(player.person.id)}
                  isDrafting={draftingPlayerId === player.person.id}
                  isMyTurn={isMyTurn}
                  onDraft={onDraftPlayer}
                  playerStats={lastSeasonStats[player.person.id]}
                  injury={isPlayerInjuredByName(getPlayerFullName(player), injuries)}
                  draftState={draftState}
                />
              </div>
            )}
            listClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRoster.map((player) => (
              <PlayerCard
                key={player.person.id}
                player={player}
                isDrafted={draftedPlayerIds.has(player.person.id)}
                isDrafting={draftingPlayerId === player.person.id}
                isMyTurn={isMyTurn}
                onDraft={onDraftPlayer}
                playerStats={lastSeasonStats[player.person.id]}
                injury={isPlayerInjuredByName(getPlayerFullName(player), injuries)}
                draftState={draftState}
              />
            ))}
          </div>
        )
      )}

      {/* No Results */}
      {!loading && !error && filteredRoster.length === 0 && (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <p className="text-xl text-gray-400 font-semibold">No players found</p>
          <p className="text-gray-500 mt-2">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
