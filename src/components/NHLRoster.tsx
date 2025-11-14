import { useState, useEffect } from 'react';
import { 
  getTeamRoster, 
  getAllPlayers, 
  getPlayerFullName,
  NHL_TEAMS,
  type RosterPerson,
  type TeamAbbrev 
} from '../utils/nhlApi';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { useDraft } from '../context/DraftContext';
import { useLeague } from '../context/LeagueContext';

export default function NHLRoster() {
  const [roster, setRoster] = useState<RosterPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<Set<number>>(new Set());
  const [draftingPlayerId, setDraftingPlayerId] = useState<number | null>(null);
  const [myTeamPositions, setMyTeamPositions] = useState({ 
    active: { F: 0, D: 0, G: 0 },
    reserve: 0,
    total: 0 
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  
  // League context for showing user's team
  const { myTeam, league } = useLeague();
  
  // Draft context
  const { draftState, currentPick, isMyTurn, advancePick } = useDraft();

  const fetchAllPlayers = async () => {
    const CACHE_KEY = 'nhl_all_players';
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    
    try {
      setLoading(true);
      setError(null);
      setRoster([]);
      
      // Check cache first
      const cached = localStorage.getItem(CACHE_KEY);
      const cacheTime = localStorage.getItem(`${CACHE_KEY}_time`);
      
      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        if (age < CACHE_DURATION) {
          console.log('📦 Loading from cache (instant!)');
          const cachedPlayers = JSON.parse(cached);
          setRoster(cachedPlayers);
          setLoading(false);
          return;
        }
      }
      
      console.log('🏒 Loading all NHL players in parallel...');
      const startTime = Date.now();
      
      // Fetch ALL teams in parallel (much faster than sequential)
      const teamPromises = (Object.keys(NHL_TEAMS) as TeamAbbrev[]).map(async (teamAbbrev) => {
        try {
          const rosterData = await getTeamRoster(teamAbbrev);
          const teamPlayers = getAllPlayers(rosterData);
          // Add team info to each player
          teamPlayers.forEach(player => {
            (player as any).teamAbbrev = teamAbbrev;
          });
          return teamPlayers;
        } catch (err) {
          console.warn(`Failed to load ${teamAbbrev}:`, err);
          return [];
        }
      });
      
      // Wait for all teams to finish loading
      const results = await Promise.all(teamPromises);
      const allPlayers = results.flat();
      
      const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Loaded ${allPlayers.length} players from ${Object.keys(NHL_TEAMS).length} teams in ${loadTime}s`);
      
      // Cache the results
      localStorage.setItem(CACHE_KEY, JSON.stringify(allPlayers));
      localStorage.setItem(`${CACHE_KEY}_time`, Date.now().toString());
      
      setRoster(allPlayers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch roster data';
      setError(errorMessage);
      console.error(err);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  };

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
      alert("It's not your turn!");
      return;
    }

    if (!currentPick) {
      alert('Draft is complete!');
      return;
    }

    try {
      setDraftingPlayerId(rosterPlayer.person.id);
      
      // Check if already drafted
      if (draftedPlayerIds.has(rosterPlayer.person.id)) {
        alert('This player has already been drafted!');
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
          alert('Reserve roster is full (5/5)! Cannot draft more players.');
          setDraftingPlayerId(null);
          return;
        }
        rosterSlot = 'reserve';
      } else if (!canAddToActive) {
        // Active position is full
        if (canAddToReserves) {
          // Ask user if they want to add to reserves
          const posName = rosterPlayer.position.name;
          const confirmed = window.confirm(
            `Active ${posName} roster is full (${myTeamPositions.active.F + myTeamPositions.active.D + myTeamPositions.active.G} active players).\n\n` +
            `Add "${getPlayerFullName(rosterPlayer)}" to RESERVES instead?\n\n` +
            `Reserves: ${myTeamPositions.reserve}/5`
          );
          
          if (!confirmed) {
            setDraftingPlayerId(null);
            return;
          }
          rosterSlot = 'reserve';
        } else {
          alert(`Cannot draft: Active ${rosterPlayer.position.name} roster is full AND reserves are full (5/5)!`);
          setDraftingPlayerId(null);
          return;
        }
      }

      // Save to Firebase with team assignment and pick info
      await addDoc(collection(db, 'draftedPlayers'), {
        playerId: rosterPlayer.person.id,
        name: getPlayerFullName(rosterPlayer),
        position: rosterPlayer.position.code,
        positionName: rosterPlayer.position.name,
        jerseyNumber: rosterPlayer.jerseyNumber,
        nhlTeam: (rosterPlayer as any).teamAbbrev || 'UNK',
        draftedByTeam: currentPick.team,
        pickNumber: currentPick.pick,
        round: currentPick.round,
        leagueId: league?.id,
        draftedAt: new Date().toISOString(),
        rosterSlot: rosterSlot // 'active' or 'reserve'
      });

      // Update local state
      setDraftedPlayerIds(prev => new Set(prev).add(rosterPlayer.person.id));
      
      // Advance to next pick
      await advancePick();
      
      console.log(`${currentPick.team} drafted: ${getPlayerFullName(rosterPlayer)} (Pick #${currentPick.pick})`);
    } catch (error) {
      console.error('Error drafting player:', error);
      alert('Failed to draft player. Please try again.');
    } finally {
      setDraftingPlayerId(null);
    }
  };

  useEffect(() => {
    fetchAllPlayers();
  }, []); // Load once on mount

  const getPositionBadgeColor = (positionCode: string) => {
    switch (positionCode) {
      case 'C':
      case 'L':
      case 'R':
        return 'bg-blue-600';
      case 'D':
        return 'bg-green-600';
      case 'G':
        return 'bg-purple-600';
      default:
        return 'bg-gray-600';
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">NHL Team Roster</h2>

      {/* Draft Status Banner */}
      {draftState && currentPick && (
        <div className={`p-4 rounded-lg mb-6 ${
          isMyTurn ? 'bg-green-900 border-2 border-green-500' : 'bg-gray-800 border-2 border-gray-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-400">
                Pick {currentPick.pick} of {draftState.totalPicks} • Round {currentPick.round}
                {myTeam && <span className="ml-2">• You are: <span className="text-blue-400">{myTeam.teamName}</span></span>}
              </p>
              <p className="text-xl font-bold text-white mt-1">
                {isMyTurn ? (
                  <span className="text-green-400">🏒 YOUR TURN! Draft a player below</span>
                ) : (
                  <span>Waiting for <span className="text-yellow-400">{currentPick.team}</span></span>
                )}
              </p>
              {isMyTurn && league?.rosterSettings && (
                <div className="mt-2 flex gap-4 text-sm">
                  <span className={myTeamPositions.active.F >= league.rosterSettings.forwards ? 'text-green-400' : 'text-gray-400'}>
                    F: {myTeamPositions.active.F}/{league.rosterSettings.forwards}
                  </span>
                  <span className={myTeamPositions.active.D >= league.rosterSettings.defensemen ? 'text-green-400' : 'text-gray-400'}>
                    D: {myTeamPositions.active.D}/{league.rosterSettings.defensemen}
                  </span>
                  <span className={myTeamPositions.active.G >= league.rosterSettings.goalies ? 'text-green-400' : 'text-gray-400'}>
                    G: {myTeamPositions.active.G}/{league.rosterSettings.goalies}
                  </span>
                  <span className="text-purple-400">
                    Reserves: {myTeamPositions.reserve}/5
                  </span>
                  <span className="text-gray-500">
                    ({myTeamPositions.total} total)
                  </span>
                </div>
              )}
            </div>
            {isMyTurn && (
              <div className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold animate-pulse">
                ON THE CLOCK
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <label className="block text-white font-semibold mb-2">🔍 Search Players:</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Position Filter */}
          <div className="md:w-48">
            <label className="block text-white font-semibold mb-2">Position:</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Positions</option>
              <option value="F">Forwards (C/L/R)</option>
              <option value="C">Center (C)</option>
              <option value="L">Left Wing (L)</option>
              <option value="R">Right Wing (R)</option>
              <option value="D">Defense (D)</option>
              <option value="G">Goalie (G)</option>
            </select>
          </div>

          {/* Team Filter */}
          <div className="md:w-48">
            <label className="block text-white font-semibold mb-2">NHL Team:</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Teams</option>
              {Object.entries(NHL_TEAMS).map(([abbrev, name]) => (
                <option key={abbrev} value={abbrev}>
                  {abbrev} - {name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Button */}
          {(searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL') && (
            <div className="md:w-auto md:self-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPositionFilter('ALL');
                  setTeamFilter('ALL');
                }}
                className="w-full md:w-auto px-4 py-3 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        {!loading && roster.length > 0 && (
          <div className="mt-4 text-gray-400 text-sm">
            Showing {filteredRoster.length} of {roster.length} players
            {searchQuery && <span className="ml-1">matching "{searchQuery}"</span>}
            {positionFilter !== 'ALL' && <span className="ml-1">• Position: {positionFilter === 'F' ? 'Forwards' : positionFilter}</span>}
            {teamFilter !== 'ALL' && <span className="ml-1">• Team: {teamFilter}</span>}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center">
          <p className="text-gray-400 text-lg">Loading roster...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 p-6 rounded-lg shadow-lg mb-8">
          <p className="text-red-200 font-semibold">⚠️ {error}</p>
        </div>
      )}

      {/* Roster Grid */}
      {!loading && !error && roster.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          {filteredRoster.length > 0 ? (
            <>
              <h3 className="text-xl font-semibold mb-6 text-white">
                {teamFilter !== 'ALL' ? `${NHL_TEAMS[teamFilter as TeamAbbrev]} - ` : 'All NHL Players - '}
                {filteredRoster.length} Player{filteredRoster.length !== 1 ? 's' : ''}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRoster.map((rosterPlayer) => {
              const isDrafted = draftedPlayerIds.has(rosterPlayer.person.id);
              const isDrafting = draftingPlayerId === rosterPlayer.person.id;

              return (
                <div
                  key={rosterPlayer.person.id}
                  className={`rounded-lg p-4 transition-all ${
                    isDrafted 
                      ? 'bg-gray-900 opacity-60 border-2 border-gray-600' 
                      : 'bg-gray-700 hover:bg-gray-650'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Player Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-white font-semibold text-lg">
                          #{rosterPlayer.jerseyNumber}
                        </span>
                        <span
                          className={`${getPositionBadgeColor(rosterPlayer.position.code)} text-white text-xs px-2 py-1 rounded font-bold`}
                        >
                          {rosterPlayer.position.code}
                        </span>
                        <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded font-bold">
                          {(rosterPlayer as any).teamAbbrev || 'UNK'}
                        </span>
                        {isDrafted && (
                          <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold">
                            DRAFTED
                          </span>
                        )}
                      </div>
                      <p className="text-white font-medium text-lg mb-1">
                        {getPlayerFullName(rosterPlayer)}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {rosterPlayer.position.name}
                      </p>
                    </div>

                    {/* Draft Button */}
                    <button
                      onClick={() => onDraftPlayer(rosterPlayer)}
                      disabled={isDrafted || isDrafting || !isMyTurn}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                        isDrafted
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : isDrafting
                          ? 'bg-yellow-600 text-white cursor-wait'
                          : !isMyTurn
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isDrafting 
                        ? 'Drafting...' 
                        : isDrafted 
                        ? 'Already Drafted' 
                        : !isMyTurn 
                        ? 'Not Your Turn' 
                        : 'Draft Player'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No players found matching your search.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setPositionFilter('ALL');
              setTeamFilter('ALL');
            }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
          >
            Clear Filters
          </button>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
