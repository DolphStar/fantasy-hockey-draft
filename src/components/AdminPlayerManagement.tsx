import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';

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
  rosterSlot?: 'active' | 'reserve';
}

export default function AdminPlayerManagement() {
  const { league, isAdmin } = useLeague();
  const [players, setPlayers] = useState<DraftedPlayer[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  // Real-time listener for all drafted players
  useEffect(() => {
    if (!league) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'draftedPlayers'),
      where('leagueId', '==', league.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DraftedPlayer));
      setPlayers(playersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [league]);

  // Remove player from league
  const removePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`Are you sure you want to remove ${playerName} from the league? This cannot be undone.`)) {
      return;
    }

    try {
      setRemoving(playerId);
      await deleteDoc(doc(db, 'draftedPlayers', playerId));
      console.log(`Removed ${playerName} from league`);
    } catch (error) {
      console.error('Error removing player:', error);
      alert('Failed to remove player. Please try again.');
    } finally {
      setRemoving(null);
    }
  };

  const getPositionBadgeVariant = (position: string): 'success' | 'warning' | 'default' => {
    switch (position) {
      case 'C':
      case 'L':
      case 'R':
        return 'default'; // Blue-ish for forwards
      case 'D':
        return 'success';
      case 'G':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (!isAdmin) {
    return (
      <GlassCard className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-center">
          <p className="text-red-200">❌ Admin access required</p>
        </div>
      </GlassCard>
    );
  }

  const filteredPlayers = selectedTeam === 'ALL'
    ? players
    : players.filter(p => p.draftedByTeam === selectedTeam);

  // Group by team
  const playersByTeam = filteredPlayers.reduce((acc, player) => {
    if (!acc[player.draftedByTeam]) {
      acc[player.draftedByTeam] = [];
    }
    acc[player.draftedByTeam].push(player);
    return acc;
  }, {} as Record<string, DraftedPlayer[]>);

  return (
    <GlassCard className="p-5 space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-700/50 pb-2">
        <span>🛠️</span> Admin: Player Management
      </h3>

      {/* Info Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
        <p className="text-amber-200 text-sm">
          ⚠️ <strong>Admin Only:</strong> Add or remove players for any team. Use with caution!
        </p>
      </div>

      {/* Team Filter */}
      <div className="space-y-2">
        <label className="block text-slate-300 font-semibold text-sm">Filter by Team:</label>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-900/50 text-white border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          <option value="ALL">All Teams ({players.length} players)</option>
          {league?.teams.map(team => {
            const teamPlayers = players.filter(p => p.draftedByTeam === team.teamName);
            return (
              <option key={team.teamName} value={team.teamName}>
                {team.teamName} ({teamPlayers.length} players)
              </option>
            );
          })}
        </select>
      </div>

      {loading ? (
        <div className="bg-slate-900/30 p-6 rounded-lg text-center">
          <p className="text-slate-400">Loading players...</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="bg-slate-900/30 p-6 rounded-lg text-center">
          <p className="text-slate-400">No players found.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {Object.entries(playersByTeam).map(([teamName, teamPlayers]) => (
            <div key={teamName} className="space-y-3">
              <h4 className="text-white font-bold flex items-center gap-2 sticky top-0 bg-slate-900/90 backdrop-blur-sm py-2 px-3 rounded-lg -mx-3">
                {teamName}
                <Badge variant="outline" className="ml-auto">{teamPlayers.length} players</Badge>
              </h4>
              <div className="space-y-2">
                {teamPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between bg-slate-800/40 p-3 rounded-lg hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={getPositionBadgeVariant(player.position)} className="text-xs">
                          {player.position}
                        </Badge>
                        <span className="text-white font-semibold text-sm">#{player.jerseyNumber}</span>
                        <span className="text-slate-400 text-xs">({player.nhlTeam})</span>
                        <Badge variant="default" className="text-xs">
                          Pick #{player.pickNumber}
                        </Badge>
                        {player.rosterSlot && (
                          <Badge variant={player.rosterSlot === 'reserve' ? 'outline' : 'success'} className="text-xs">
                            {player.rosterSlot === 'reserve' ? 'BENCH' : 'ACTIVE'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-white font-medium truncate">{player.name}</p>
                      <p className="text-slate-400 text-xs">{player.positionName} • Round {player.round}</p>
                    </div>
                    <button
                      onClick={() => removePlayer(player.id, player.name)}
                      disabled={removing === player.id}
                      className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-3 py-1.5 rounded-lg transition-all text-xs font-bold ml-3 border border-red-900/50 active:scale-95 disabled:opacity-50"
                    >
                      {removing === player.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note about adding players */}
      <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg text-sm">
        <p className="text-blue-200">
          💡 <strong>To add players:</strong> Players can use the "NHL Rosters" tab during their draft turn.
        </p>
      </div>
    </GlassCard>
  );
}
