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
  const [selectedTeam, setSelectedTeam] = useState<TeamAbbrev>('VAN');
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<Set<number>>(new Set());
  const [draftingPlayerId, setDraftingPlayerId] = useState<number | null>(null);
  const [myTeamPositions, setMyTeamPositions] = useState({ F: 0, D: 0, G: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  
  // League context for showing user's team
  const { myTeam, league } = useLeague();
  
  // Draft context
  const { draftState, currentPick, isMyTurn, advancePick } = useDraft();

  const fetchRoster = async (teamAbbrev: TeamAbbrev) => {
    try {
      setLoading(true);
      setError(null);
      setRoster([]); // Clear previous roster
      const rosterData = await getTeamRoster(teamAbbrev);
      const allPlayers = getAllPlayers(rosterData);
      setRoster(allPlayers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch roster data';
      setError(errorMessage);
      console.error(err);
      setRoster([]); // Clear roster on error
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time listener for drafted players
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'draftedPlayers'), (snapshot) => {
      const draftedIds = new Set<number>();
      let myForwards = 0, myDefense = 0, myGoalies = 0, myTotal = 0;
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        draftedIds.add(data.playerId);
        
        // Count positions for my team
        if (myTeam && data.draftedByTeam === myTeam.teamName) {
          myTotal++;
          const pos = data.position;
          if (['C', 'L', 'R'].includes(pos)) {
            myForwards++;
          } else if (pos === 'D') {
            myDefense++;
          } else if (pos === 'G') {
            myGoalies++;
          }
        }
      });
      
      setDraftedPlayerIds(draftedIds);
      setMyTeamPositions({ F: myForwards, D: myDefense, G: myGoalies, total: myTotal });
    });
    
    return () => unsubscribe();
  }, [myTeam]);

  // Check if we can draft a player of this position
  const canDraftPosition = (position: string): boolean => {
    if (!league?.rosterSettings) return true; // No limits if not configured
    
    const { F, D, G, total } = myTeamPositions;
    const { forwards, defensemen, goalies } = league.rosterSettings;
    const totalRequired = forwards + defensemen + goalies;
    
    // If we're in reserves (last 5 picks), allow any position
    if (total >= totalRequired) {
      return true;
    }
    
    // Check position-specific limits
    if (['C', 'L', 'R'].includes(position)) {
      return F < forwards;
    } else if (position === 'D') {
      return D < defensemen;
    } else if (position === 'G') {
      return G < goalies;
    }
    
    return false;
  };

  // Draft a player to Firebase
  const onDraftPlayer = async (rosterPlayer: RosterPerson) => {
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
      
      // Check position limits
      if (!canDraftPosition(rosterPlayer.position.code)) {
        alert(`You've reached the limit for ${rosterPlayer.position.name}s! Pick a different position or add to reserves.`);
        setDraftingPlayerId(null);
        return;
      }

      // Save to Firebase with team assignment and pick info
      await addDoc(collection(db, 'draftedPlayers'), {
        playerId: rosterPlayer.person.id,
        name: getPlayerFullName(rosterPlayer),
        position: rosterPlayer.position.code,
        positionName: rosterPlayer.position.name,
        jerseyNumber: rosterPlayer.jerseyNumber,
        nhlTeam: selectedTeam,
        draftedByTeam: currentPick.team, // Which fantasy team drafted them
        pickNumber: currentPick.pick,
        round: currentPick.round,
        leagueId: league?.id, // Link to league for scoring
        draftedAt: new Date().toISOString()
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
    fetchRoster(selectedTeam);
  }, [selectedTeam]);

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

  // Filter roster based on search and position
  const filteredRoster = roster.filter(player => {
    const playerName = getPlayerFullName(player).toLowerCase();
    const matchesSearch = searchQuery === '' || playerName.includes(searchQuery.toLowerCase());
    
    const matchesPosition = positionFilter === 'ALL' || 
      (positionFilter === 'F' && ['C', 'L', 'R'].includes(player.position.code)) ||
      (positionFilter === player.position.code);
    
    return matchesSearch && matchesPosition;
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
                  <span className={myTeamPositions.F >= league.rosterSettings.forwards ? 'text-green-400' : 'text-gray-400'}>
                    F: {myTeamPositions.F}/{league.rosterSettings.forwards}
                  </span>
                  <span className={myTeamPositions.D >= league.rosterSettings.defensemen ? 'text-green-400' : 'text-gray-400'}>
                    D: {myTeamPositions.D}/{league.rosterSettings.defensemen}
                  </span>
                  <span className={myTeamPositions.G >= league.rosterSettings.goalies ? 'text-green-400' : 'text-gray-400'}>
                    G: {myTeamPositions.G}/{league.rosterSettings.goalies}
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

      {/* Team Selector */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
        <label className="block text-white font-semibold mb-3">Select Team:</label>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value as TeamAbbrev)}
          className="w-full md:w-auto px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
        >
          {Object.entries(NHL_TEAMS).map(([abbrev, name]) => (
            <option key={abbrev} value={abbrev}>
              {name} ({abbrev})
            </option>
          ))}
        </select>
      </div>

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
            <label className="block text-white font-semibold mb-2">Filter by Position:</label>
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

          {/* Clear Button */}
          {(searchQuery || positionFilter !== 'ALL') && (
            <div className="md:w-auto md:self-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPositionFilter('ALL');
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
                {NHL_TEAMS[selectedTeam]} - {filteredRoster.length} Player{filteredRoster.length !== 1 ? 's' : ''}
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
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-semibold text-lg">
                          #{rosterPlayer.jerseyNumber}
                        </span>
                        <span
                          className={`${getPositionBadgeColor(rosterPlayer.position.code)} text-white text-xs px-2 py-1 rounded font-bold`}
                        >
                          {rosterPlayer.position.code}
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
