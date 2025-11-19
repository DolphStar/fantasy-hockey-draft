import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { isPlayerInjuredByName, getInjuryIcon } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
import { toast } from 'sonner';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';
import { GradientButton } from './ui/GradientButton';

interface DraftedPlayer {
  id: string;
  playerId: string;
  name: string;
  position: string;
  positionName: string;
  nhlTeam: string;
  jerseyNumber: number;
  round: number;
  pickNumber: number;
  draftedBy: string;
  draftedByTeam: string;
  rosterSlot: 'active' | 'reserve';
  pendingSlot?: 'active' | 'reserve' | null; // For pending swaps
}

export default function PlayerList() {
  useAuth();
  const { league, myTeam } = useLeague();
  const [players, setPlayers] = useState<DraftedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [swapping, setSwapping] = useState<string | null>(null); // Player ID being swapped
  const [selectedForSwap, setSelectedForSwap] = useState<{
    playerId: string;
    playerName: string;
    position: string;
    currentSlot: 'active' | 'reserve';
  } | null>(null);

  const { data: injuries = [] } = useInjuries();

  // Helper to get next Saturday at 5 AM
  const getNextSaturday = () => {
    const d = new Date();
    d.setDate(d.getDate() + (6 - d.getDay() + 7) % 7);
    d.setHours(5, 0, 0, 0);
    // If today is Saturday and it's past 5 AM, move to next Saturday
    if (d.getDay() === 6 && new Date().getHours() >= 5) {
      d.setDate(d.getDate() + 7);
    }
    return d;
  };

  // Helper to get position name
  const getPositionName = (pos: string) => {
    switch (pos) {
      case 'C': return 'Center';
      case 'L': return 'Left Wing';
      case 'R': return 'Right Wing';
      case 'D': return 'Defenseman';
      case 'G': return 'Goalie';
      default: return pos;
    }
  };

  // Check if swap is valid (must be same position)
  const isSwapDisabled = (player: DraftedPlayer) => {
    if (!selectedForSwap) return false;
    // Must be same position
    if (player.position !== selectedForSwap.position) return true;
    // Must be different roster slot
    if (player.rosterSlot === selectedForSwap.currentSlot) return true;
    return false;
  };

  // Select player for swap
  const selectPlayerForSwap = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    if (selectedForSwap) {
      // If clicking the same player, deselect
      if (selectedForSwap.playerId === playerId) {
        setSelectedForSwap(null);
        return;
      }

      // If clicking a valid target, execute swap
      if (!isSwapDisabled(player)) {
        executeSwap(selectedForSwap.playerId, playerId);
      }
    } else {
      // Select first player
      setSelectedForSwap({
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        currentSlot: player.rosterSlot
      });
    }
  };

  // Execute swap request
  const executeSwap = async (player1Id: string, player2Id: string) => {
    try {
      setSwapping(player1Id); // Show loading state
      const player1 = players.find(p => p.id === player1Id);
      const player2 = players.find(p => p.id === player2Id);

      if (!player1 || !player2) return;

      // Determine target slots (swap them)
      const player1CurrentSlot = player1.rosterSlot || 'active';
      const player2CurrentSlot = player2.rosterSlot || 'active';

      // Update both players with pendingSlot
      const p1Ref = doc(db, 'draftedPlayers', player1Id);
      const p2Ref = doc(db, 'draftedPlayers', player2Id);

      await updateDoc(p1Ref, {
        pendingSlot: player2CurrentSlot // Move to other slot
      });

      await updateDoc(p2Ref, {
        pendingSlot: player1CurrentSlot // Move to other slot
      });

      toast.success('Swap requested successfully!');
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

  // Show message if no league or team
  if (!league || !myTeam) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-white">My Players</h2>
        <GlassCard className="p-8 text-center">
          <p className="text-gray-400 text-lg">No league found. Create or join a league to see your roster.</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">{myTeam.teamName}'s Roster</h2>

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
      <GlassCard className="p-6 mb-6">
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
                className="flex items-center justify-between bg-gray-700/50 p-4 rounded-lg hover:bg-gray-700 transition-colors border border-gray-600/30"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-white font-semibold">#{player.jerseyNumber}</span>
                    <Badge variant={
                      ['C', 'L', 'R'].includes(player.position) ? 'info' :
                        player.position === 'D' ? 'success' :
                          player.position === 'G' ? 'warning' : 'default'
                    }>
                      {player.position}
                    </Badge>
                    <span className="text-gray-400 text-sm">({player.nhlTeam})</span>
                    <Badge variant="outline" className="font-normal">
                      Pick #{player.pickNumber}
                    </Badge>
                    {player.pendingSlot && (
                      <Badge variant="warning" className="animate-pulse">
                        → {player.pendingSlot === 'reserve' ? 'Moving to Reserve' : 'Staying Active'}
                      </Badge>
                    )}
                    {(() => {
                      const injury = isPlayerInjuredByName(player.name, injuries);
                      return injury && (
                        <Badge variant="danger" className="flex items-center gap-1">
                          {getInjuryIcon(injury.status)} {injury.status.toUpperCase()}
                        </Badge>
                      );
                    })()}
                  </div>
                  <p className="text-white font-medium text-lg">{player.name}</p>
                  <p className="text-gray-400 text-sm">{player.positionName} • Round {player.round}</p>
                </div>
                {player.pendingSlot ? (
                  <GradientButton
                    onClick={() => cancelSwap(player.id)}
                    disabled={swapping === player.id}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                  >
                    Cancel Swap
                  </GradientButton>
                ) : (
                  <GradientButton
                    onClick={() => selectPlayerForSwap(player.id)}
                    disabled={swapping === player.id || isSwapDisabled(player)}
                    variant={selectedForSwap?.playerId === player.id ? 'secondary' : 'primary'}
                    size="sm"
                    className="ml-4"
                  >
                    {selectedForSwap?.playerId === player.id ? '✓ Selected' : '🔄 Select to Swap'}
                  </GradientButton>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Reserve Roster */}
      <GlassCard className="p-6">
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
                className="flex items-center justify-between bg-gray-700/50 p-4 rounded-lg hover:bg-gray-700 transition-colors border border-gray-600/30"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-white font-semibold">#{player.jerseyNumber}</span>
                    <Badge variant={
                      ['C', 'L', 'R'].includes(player.position) ? 'info' :
                        player.position === 'D' ? 'success' :
                          player.position === 'G' ? 'warning' : 'default'
                    }>
                      {player.position}
                    </Badge>
                    <span className="text-gray-400 text-sm">({player.nhlTeam})</span>
                    <Badge variant="outline" className="font-normal">
                      Pick #{player.pickNumber}
                    </Badge>
                    {player.pendingSlot && (
                      <Badge variant="warning" className="animate-pulse">
                        → {player.pendingSlot === 'active' ? 'Moving to Active' : 'Staying Reserve'}
                      </Badge>
                    )}
                    {(() => {
                      const injury = isPlayerInjuredByName(player.name, injuries);
                      return injury && (
                        <Badge variant="danger" className="flex items-center gap-1">
                          {getInjuryIcon(injury.status)} {injury.status.toUpperCase()}
                        </Badge>
                      );
                    })()}
                  </div>
                  <p className="text-white font-medium text-lg">{player.name}</p>
                  <p className="text-gray-400 text-sm">{player.positionName} • Round {player.round}</p>
                </div>
                {player.pendingSlot ? (
                  <GradientButton
                    onClick={() => cancelSwap(player.id)}
                    disabled={swapping === player.id}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                  >
                    Cancel Swap
                  </GradientButton>
                ) : (
                  <GradientButton
                    onClick={() => selectPlayerForSwap(player.id)}
                    disabled={swapping === player.id || isSwapDisabled(player)}
                    variant={selectedForSwap?.playerId === player.id ? 'secondary' : 'primary'}
                    size="sm"
                    className="ml-4"
                  >
                    {selectedForSwap?.playerId === player.id ? '✓ Selected' : '🔄 Select to Swap'}
                  </GradientButton>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
