import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, query, where, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import { isPlayerInjuredByName, getInjuryIcon, getInjuryColor } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
import { toast } from 'sonner';

interface DraftedPlayer {
  id: string;
  playerId: number;
  name: string;
  position: string;
  positionName: string;
  jerseyNumber: string;
  nhlTeam: string;
  draftedByTeam: string;
  pickNumber: number;
  round: number;
  draftedAt: string;
  rosterSlot?: 'active' | 'reserve'; // Default to 'active' if not set
  pendingSlot?: 'active' | 'reserve'; // Pending change for next Saturday
}

export default function PlayerList() {
  const { myTeam, league } = useLeague();
  const [players, setPlayers] = useState<DraftedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [selectedForSwap, setSelectedForSwap] = useState<{
    playerId: string;
    playerName: string;
    position: string;
    currentSlot: 'active' | 'reserve';
  } | null>(null);
  
  // React Query hook for injuries - automatic caching!
  const { data: injuries = [] } = useInjuries();

  // Calculate next Saturday at 9 AM ET
  const getNextSaturday = () => {
    const now = new Date();
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7 || 7; // Days until next Saturday
    const nextSat = new Date(now);
    nextSat.setDate(now.getDate() + daysUntilSaturday);
    nextSat.setHours(9, 0, 0, 0); // 9 AM
    return nextSat;
  };

  // Select player for swap
  const selectPlayerForSwap = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const currentSlot = (player.rosterSlot || 'active') as 'active' | 'reserve';
    
    // If no player selected yet, select this one
    if (!selectedForSwap) {
      setSelectedForSwap({
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        currentSlot: currentSlot
      });
      return;
    }

    // If same player clicked again, deselect
    if (selectedForSwap.playerId === playerId) {
      setSelectedForSwap(null);
      return;
    }

    // If different slot (one active, one reserve) and same position type, perform swap
    const targetSlot = currentSlot;
    if (selectedForSwap.currentSlot !== targetSlot && isSamePositionType(selectedForSwap.position, player.position)) {
      performSwap(selectedForSwap.playerId, playerId);
    } else if (selectedForSwap.currentSlot === targetSlot) {
      toast.error('Same roster slot', {
        description: `Both players are in ${targetSlot}. Select one active and one reserve player.`
      });
    } else {
      toast.error('Position mismatch!', {
        description: `You can only swap players of the same position type.\n\nSelected: ${selectedForSwap.position} (${getPositionName(selectedForSwap.position)})\nClicked: ${player.position} (${player.positionName})`
      });
    }
  };

  // Check if two positions are the same type (all forwards count as same)
  const isSamePositionType = (pos1: string, pos2: string): boolean => {
    const forwards = ['C', 'L', 'R'];
    if (forwards.includes(pos1) && forwards.includes(pos2)) return true;
    return pos1 === pos2;
  };

  // Get position TYPE for swap messaging (group all forwards together)
  const getPositionName = (pos: string): string => {
    if (['C', 'L', 'R'].includes(pos)) return 'Forward';
    if (pos === 'D') return 'Defense';
    if (pos === 'G') return 'Goalie';
    return pos;
  };

  // Check if swap button should be disabled for this player
  const isSwapDisabled = (player: DraftedPlayer): boolean => {
    if (!selectedForSwap) return false; // No selection, all buttons enabled
    
    const currentSlot = (player.rosterSlot || 'active') as 'active' | 'reserve';
    
    // Can't swap with yourself
    if (selectedForSwap.playerId === player.id) return false;
    
    // Must be in opposite roster (active ↔ reserve)
    if (selectedForSwap.currentSlot === currentSlot) return true;
    
    // Must be same position type
    if (!isSamePositionType(selectedForSwap.position, player.position)) return true;
    
    return false;
  };

  // Perform atomic swap between two players
  const performSwap = async (player1Id: string, player2Id: string) => {
    try {
      setSwapping(player1Id);

      const player1Ref = doc(db, 'draftedPlayers', player1Id);
      const player2Ref = doc(db, 'draftedPlayers', player2Id);

      const player1 = players.find(p => p.id === player1Id);
      const player2 = players.find(p => p.id === player2Id);

      if (!player1 || !player2) return;

      const player1CurrentSlot = (player1.rosterSlot || 'active') as 'active' | 'reserve';
      const player2CurrentSlot = (player2.rosterSlot || 'active') as 'active' | 'reserve';

      // Mark both players with pending swaps (will apply on Saturday)
      await updateDoc(player1Ref, {
        pendingSlot: player2CurrentSlot
      });

      await updateDoc(player2Ref, {
        pendingSlot: player1CurrentSlot
      });

      console.log(`Swap requested: "${player1.name}" ↔ "${player2.name}" will swap on ${getNextSaturday().toDateString()}`);
      alert(`✅ Swap requested!\n\n"${player1.name}" (${player1CurrentSlot}) ↔ "${player2.name}" (${player2CurrentSlot})\n\nWill apply on ${getNextSaturday().toLocaleDateString()}`);
      
      setSelectedForSwap(null);
    } catch (error) {
      console.error('Error requesting swap:', error);
      alert('Failed to request swap. Please try again.');
    } finally {
      setSwapping(null);
    }
  };

  // Cancel pending swap
  const cancelSwap = async (playerId: string) => {
    try {
      setSwapping(playerId);
      const playerRef = doc(db, 'draftedPlayers', playerId);
      await updateDoc(playerRef, {
        pendingSlot: null
      });
    } catch (error) {
      console.error('Error canceling swap:', error);
    } finally {
      setSwapping(null);
    }
  };

  // Get position badge color
  const getPositionBadgeColor = (position: string) => {
    switch (position) {
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

  // Count active roster by position
  const countActiveRoster = () => {
    const active = players.filter(p => (p.rosterSlot || 'active') === 'active');
    const forwards = active.filter(p => ['C', 'L', 'R'].includes(p.position)).length;
    const defense = active.filter(p => p.position === 'D').length;
    const goalies = active.filter(p => p.position === 'G').length;
    return { forwards, defense, goalies, total: active.length };
  };

  // Note: With atomic swaps, we don't need validation functions
  // The swap logic ensures active roster stays at exactly 9F/6D/2G

  // React Query automatically handles injury fetching and refetching!

  // Real-time listener for drafted players
  useEffect(() => {
    if (!myTeam) {
      console.log('PlayerList: No team assigned to user');
      setLoading(false);
      return;
    }

    console.log('PlayerList: Setting up listener for team:', myTeam.teamName);
    
    // Query only players drafted by your team
    const q = query(
      collection(db, 'draftedPlayers'),
      where('draftedByTeam', '==', myTeam.teamName),
      orderBy('pickNumber', 'asc')
    );
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const playersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DraftedPlayer));
      
      console.log(`PlayerList: Found ${playersData.length} players for team "${myTeam.teamName}"`);
      setPlayers(playersData);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to players:', error);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [myTeam]);

  // Sort players by position: Forwards (C, L, R) → Defense (D) → Goalies (G)
  const sortByPosition = (a: DraftedPlayer, b: DraftedPlayer) => {
    const getPositionOrder = (pos: string) => {
      if (['C', 'L', 'R'].includes(pos)) return 1; // Forwards first
      if (pos === 'D') return 2; // Defense second
      if (pos === 'G') return 3; // Goalies third
      return 4; // Unknown positions last
    };
    
    const orderDiff = getPositionOrder(a.position) - getPositionOrder(b.position);
    if (orderDiff !== 0) return orderDiff;
    
    // Within same position group, sort by pick number
    return a.pickNumber - b.pickNumber;
  };

  const activePlayers = players
    .filter(p => (p.rosterSlot || 'active') === 'active')
    .sort(sortByPosition);
  const reservePlayers = players
    .filter(p => p.rosterSlot === 'reserve')
    .sort(sortByPosition);
  const rosterCounts = countActiveRoster();
  const nextSaturday = getNextSaturday();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">{myTeam?.teamName || 'My'}'s Roster</h2>

      {/* Roster Lock Info */}
      <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-lg mb-4">
        <p className="text-blue-200 text-sm">
          📅 <strong>Next Roster Lock:</strong> {nextSaturday.toLocaleString()} 
          <span className="ml-2 text-gray-400">• Pending swaps will apply then</span>
        </p>
      </div>

      {/* Swap Instructions */}
      {selectedForSwap && (
        <div className="bg-yellow-900/30 border-2 border-yellow-500 p-4 rounded-lg mb-4">
          <p className="text-yellow-200 font-semibold mb-2">
            🔄 Swap Mode Active
          </p>
          <p className="text-yellow-100 text-sm mb-2">
            Selected: <strong>{selectedForSwap.playerName}</strong> ({getPositionName(selectedForSwap.position)}) 
            {' '}in <strong>{selectedForSwap.currentSlot}</strong> roster
          </p>
          <p className="text-gray-300 text-sm">
            Now select a <strong>{getPositionName(selectedForSwap.position)}</strong> from the{' '}
            <strong>{selectedForSwap.currentSlot === 'active' ? 'Reserve' : 'Active'}</strong> roster to swap with.
          </p>
          <button
            onClick={() => setSelectedForSwap(null)}
            className="mt-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
          >
            Cancel Selection
          </button>
        </div>
      )}

      {!selectedForSwap && (
        <div className="bg-gray-700/50 border border-gray-600 p-4 rounded-lg mb-6">
          <p className="text-gray-300 text-sm">
            <strong>💡 How to Swap Players:</strong> Click "🔄 Select to Swap" on a player, 
            then select another player of the same position from the opposite roster (active ↔ reserve) to swap them.
          </p>
        </div>
      )}

      {/* Active Roster */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">
            🏒 Active Roster ({activePlayers.length})
          </h3>
          {league?.rosterSettings && (
            <div className="flex gap-4 text-sm">
              <span className={rosterCounts.forwards >= league.rosterSettings.forwards ? 'text-green-400' : 'text-gray-400'}>
                F: {rosterCounts.forwards}/{league.rosterSettings.forwards}
              </span>
              <span className={rosterCounts.defense >= league.rosterSettings.defensemen ? 'text-green-400' : 'text-gray-400'}>
                D: {rosterCounts.defense}/{league.rosterSettings.defensemen}
              </span>
              <span className={rosterCounts.goalies >= league.rosterSettings.goalies ? 'text-green-400' : 'text-gray-400'}>
                G: {rosterCounts.goalies}/{league.rosterSettings.goalies}
              </span>
            </div>
          )}
        </div>
        {loading ? (
          <p className="text-gray-400">Loading players...</p>
        ) : activePlayers.length === 0 ? (
          <p className="text-gray-400">No active roster players yet.</p>
        ) : (
          <div className="space-y-3">
            {activePlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-gray-700 p-4 rounded-lg hover:bg-gray-650 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-white font-semibold">#{player.jerseyNumber}</span>
                    <span className={`${getPositionBadgeColor(player.position)} text-white text-xs px-2 py-1 rounded font-bold`}>
                      {player.position}
                    </span>
                    <span className="text-gray-400 text-sm">({player.nhlTeam})</span>
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                      Pick #{player.pickNumber}
                    </span>
                    {player.pendingSlot && (
                      <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded animate-pulse">
                        → {player.pendingSlot === 'reserve' ? 'Moving to Reserve' : 'Staying Active'}
                      </span>
                    )}
                    {(() => {
                      const injury = isPlayerInjuredByName(player.name, injuries);
                      return injury && (
                        <span className={`${getInjuryColor(injury.status)} text-white text-xs px-2 py-1 rounded font-bold flex items-center gap-1`} title={`${injury.injuryType} - ${injury.description}`}>
                          {getInjuryIcon(injury.status)} {injury.status.toUpperCase()}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-white font-medium text-lg">{player.name}</p>
                  <p className="text-gray-400 text-sm">{player.positionName} • Round {player.round}</p>
                </div>
                {player.pendingSlot ? (
                  <button
                    onClick={() => cancelSwap(player.id)}
                    disabled={swapping === player.id}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors ml-4"
                  >
                    Cancel Swap
                  </button>
                ) : (
                  <button
                    onClick={() => selectPlayerForSwap(player.id)}
                    disabled={swapping === player.id || isSwapDisabled(player)}
                    className={`px-4 py-2 rounded transition-colors ml-4 ${
                      selectedForSwap?.playerId === player.id
                        ? 'bg-yellow-600 text-white font-bold ring-2 ring-yellow-400'
                        : isSwapDisabled(player)
                        ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {selectedForSwap?.playerId === player.id ? '✓ Selected' : '🔄 Select to Swap'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reserve Roster */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-white">
          💼 Reserve Roster ({reservePlayers.length})
        </h3>
        {loading ? (
          <p className="text-gray-400">Loading players...</p>
        ) : players.length === 0 ? (
          <p className="text-gray-400">
            No players drafted yet. Go to the "NHL Rosters" tab and click "Draft Player" on any player!
          </p>
        ) : reservePlayers.length === 0 ? (
          <p className="text-gray-400">No reserve players. All players are on active roster.</p>
        ) : (
          <div className="space-y-3">
            {reservePlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-gray-700 p-4 rounded-lg hover:bg-gray-650 transition-colors opacity-75"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-white font-semibold">#{player.jerseyNumber}</span>
                    <span className={`${getPositionBadgeColor(player.position)} text-white text-xs px-2 py-1 rounded font-bold`}>
                      {player.position}
                    </span>
                    <span className="text-gray-400 text-sm">({player.nhlTeam})</span>
                    <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded">
                      Pick #{player.pickNumber}
                    </span>
                    {player.pendingSlot && (
                      <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded animate-pulse">
                        → {player.pendingSlot === 'active' ? 'Moving to Active' : 'Staying Reserve'}
                      </span>
                    )}
                    {(() => {
                      const injury = isPlayerInjuredByName(player.name, injuries);
                      return injury && (
                        <span className={`${getInjuryColor(injury.status)} text-white text-xs px-2 py-1 rounded font-bold flex items-center gap-1`} title={`${injury.injuryType} - ${injury.description}`}>
                          {getInjuryIcon(injury.status)} {injury.status.toUpperCase()}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-white font-medium text-lg">{player.name}</p>
                  <p className="text-gray-400 text-sm">{player.positionName} • Round {player.round}</p>
                </div>
                {player.pendingSlot ? (
                  <button
                    onClick={() => cancelSwap(player.id)}
                    disabled={swapping === player.id}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors ml-4"
                  >
                    Cancel Swap
                  </button>
                ) : (
                  <button
                    onClick={() => selectPlayerForSwap(player.id)}
                    disabled={swapping === player.id || isSwapDisabled(player)}
                    className={`px-4 py-2 rounded transition-colors ml-4 ${
                      selectedForSwap?.playerId === player.id
                        ? 'bg-yellow-600 text-white font-bold ring-2 ring-yellow-400'
                        : isSwapDisabled(player)
                        ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {selectedForSwap?.playerId === player.id ? '✓ Selected' : '🔄 Select to Swap'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
