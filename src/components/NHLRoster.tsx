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
import { collection, addDoc, onSnapshot, runTransaction, doc } from 'firebase/firestore';
import { useDraft } from '../context/DraftContext';
import { useLeague } from '../context/LeagueContext';
import { useSound } from '../context/SoundContext';
import { isPlayerInjuredByName } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
import { useTeamRoster } from '../queries/useTeamRoster';
import PlayerCard from './roster/PlayerCard';
import RosterFilters from './roster/RosterFilters';
import DraftStatus from './draft/DraftStatus';
import PositionScarcity from './draft/PositionScarcity';
import BestAvailable from './draft/BestAvailable';

export default function NHLRoster() {
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<Set<number>>(new Set());
  const [draftingPlayerId, setDraftingPlayerId] = useState<number | null>(null);
  const [myTeamPositions, setMyTeamPositions] = useState({
    active: { F: 0, D: 0, G: 0 },
    reserve: 0,
    total: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ANA'); // Default to Anaheim Ducks
  const [pickupTeam, setPickupTeam] = useState<string>(''); // Admin: which team to pick up for
  const [lastSeasonStats, setLastSeasonStats] = useState<StatsMap>({}); // Last season stats

  // League context for showing user's team
  const { myTeam, league, isAdmin } = useLeague();

  // Draft context
  const { draftState, currentPick, isMyTurn } = useDraft();
  const { playSound } = useSound();

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

  // Admin: Pick up free agent for a team
  const pickUpFreeAgent = async (rosterPlayer: any) => {
    if (!isAdmin) {
      toast.error('Admin only', {
        description: 'Only the league admin can pick up free agents.'
      });
      return;
    }

    if (!pickupTeam) {
      toast.warning('Select a team', {
        description: 'Please choose which team to pick up this player for.'
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

      const confirmed = window.confirm(
        `Pick up "${getPlayerFullName(rosterPlayer)}" for team "${pickupTeam}"?\n\nThis will add them to the active roster.`
      );

      if (!confirmed) {
        setDraftingPlayerId(null);
        return;
      }

      // Add to active roster by default
      await addDoc(collection(db, 'draftedPlayers'), {
        playerId: rosterPlayer.person.id,
        name: getPlayerFullName(rosterPlayer),
        position: rosterPlayer.position.code,
        positionName: rosterPlayer.position.name,
        jerseyNumber: rosterPlayer.jerseyNumber,
        nhlTeam: (rosterPlayer as any).teamAbbrev || 'UNK',
        draftedByTeam: pickupTeam,
        pickNumber: 0, // Free agent pickup
        round: 0, // Free agent pickup
        leagueId: league?.id,
        draftedAt: new Date().toISOString(),
        rosterSlot: 'active'
      });

      // Update local state
      setDraftedPlayerIds(prev => new Set(prev).add(rosterPlayer.person.id));

      console.log(`Admin picked up: ${getPlayerFullName(rosterPlayer)} for ${pickupTeam}`);
      toast.success(`Picked up ${getPlayerFullName(rosterPlayer)}!`, {
        description: `Added to ${pickupTeam}'s active roster as a free agent.`
      });
    } catch (error) {
      console.error('Error picking up player:', error);
      toast.error('Failed to pick up player', {
        description: 'Something went wrong. Please try again.'
      });
    } finally {
      setDraftingPlayerId(null);
    }
  };

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
    <div className="max-w-6xl mx-auto p-6">
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

      {/* Best Available & Position Scarcity Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <BestAvailable
            allPlayers={roster}
            draftedPlayerIds={draftedPlayerIds}
            lastSeasonStats={lastSeasonStats}
            onDraft={onDraftPlayer}
            isMyTurn={isMyTurn}
          />
          <PositionScarcity allPlayers={roster} draftedPlayerIds={draftedPlayerIds} />
        </div>
      )}

      {/* Admin: Team Selector for Free Agent Pickups */}
      {isAdmin && (
        <div className="bg-purple-900/30 border border-purple-500/30 p-4 rounded-lg mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1">
              <p className="text-purple-200 font-semibold mb-1">
                👑 Admin Mode: Pick Up Free Agents
              </p>
              <p className="text-gray-400 text-sm">
                Select a team below, then click "Pick Up" on any undrafted player to add them to that team's roster.
              </p>
            </div>
            <div className="md:w-64">
              <label className="block text-white font-semibold mb-2 text-sm">Pick up for team:</label>
              <select
                value={pickupTeam}
                onChange={(e) => setPickupTeam(e.target.value)}
                className="w-full px-4 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="">-- Select Team --</option>
                {league?.teams.map((team) => (
                  <option key={team.teamName} value={team.teamName}>
                    {team.teamName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
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
                  isAdmin={isAdmin}
                  onDraft={onDraftPlayer}
                  onPickUp={pickUpFreeAgent}
                  playerStats={lastSeasonStats[player.person.id]}
                  injury={isPlayerInjuredByName(getPlayerFullName(player), injuries)}
                  draftState={draftState}
                />
              </div>
            )}
            listClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoster.map((player) => (
              <PlayerCard
                key={player.person.id}
                player={player}
                isDrafted={draftedPlayerIds.has(player.person.id)}
                isDrafting={draftingPlayerId === player.person.id}
                isMyTurn={isMyTurn}
                isAdmin={isAdmin}
                onDraft={onDraftPlayer}
                onPickUp={pickUpFreeAgent}
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
