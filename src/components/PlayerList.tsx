import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, query, where, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';

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

  // Request roster slot swap (applies next Saturday)
  const requestSwap = async (playerId: string, newSlot: 'active' | 'reserve') => {
    try {
      setSwapping(playerId);
      const playerRef = doc(db, 'draftedPlayers', playerId);
      await updateDoc(playerRef, {
        pendingSlot: newSlot
      });
      console.log(`Swap requested: Will move to ${newSlot} on ${getNextSaturday().toDateString()}`);
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

  // Check if we can move player to active
  const canMoveToActive = (position: string) => {
    if (!league?.rosterSettings) return true;
    const counts = countActiveRoster();
    
    if (['C', 'L', 'R'].includes(position)) {
      return counts.forwards < league.rosterSettings.forwards;
    } else if (position === 'D') {
      return counts.defense < league.rosterSettings.defensemen;
    } else if (position === 'G') {
      return counts.goalies < league.rosterSettings.goalies;
    }
    return false;
  };

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

  const activePlayers = players.filter(p => (p.rosterSlot || 'active') === 'active');
  const reservePlayers = players.filter(p => p.rosterSlot === 'reserve');
  const rosterCounts = countActiveRoster();
  const nextSaturday = getNextSaturday();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">{myTeam?.teamName || 'My'}'s Roster</h2>

      {/* Roster Lock Info */}
      <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-lg mb-6">
        <p className="text-blue-200 text-sm">
          📅 <strong>Next Roster Lock:</strong> {nextSaturday.toLocaleString()} 
          <span className="ml-2 text-gray-400">• Pending swaps will apply then</span>
        </p>
      </div>

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
                    onClick={() => requestSwap(player.id, 'reserve')}
                    disabled={swapping === player.id}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded transition-colors ml-4"
                  >
                    → Reserve
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
                ) : canMoveToActive(player.position) ? (
                  <button
                    onClick={() => requestSwap(player.id, 'active')}
                    disabled={swapping === player.id}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors ml-4"
                  >
                    → Active
                  </button>
                ) : (
                  <span className="text-gray-500 text-sm ml-4">Active roster full</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
