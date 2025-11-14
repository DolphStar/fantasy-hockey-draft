import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import { getPlayerFullName, type RosterPerson } from '../utils/nhlApi';

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

  // Add player manually (for commissioner adds)
  const addPlayerManually = async (playerData: RosterPerson, teamName: string) => {
    try {
      const highestPick = Math.max(...players.map(p => p.pickNumber), 0);
      
      await addDoc(collection(db, 'draftedPlayers'), {
        playerId: playerData.person.id,
        name: getPlayerFullName(playerData),
        position: playerData.position.code,
        positionName: playerData.position.name,
        jerseyNumber: playerData.jerseyNumber,
        nhlTeam: (playerData as any).teamAbbrev || 'UNK',
        draftedByTeam: teamName,
        pickNumber: highestPick + 1,
        round: Math.ceil((highestPick + 1) / (league?.teams.length || 1)),
        leagueId: league?.id,
        draftedAt: new Date().toISOString(),
        rosterSlot: 'active'
      });

      console.log(`Manually added ${getPlayerFullName(playerData)} to ${teamName}`);
    } catch (error) {
      console.error('Error adding player:', error);
      alert('Failed to add player. Please try again.');
    }
  };

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

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-900/50 border border-red-600 p-6 rounded-lg">
          <p className="text-red-200">❌ Admin access required</p>
        </div>
      </div>
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
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">🛠️ Admin: Player Management</h2>

      {/* Info Banner */}
      <div className="bg-yellow-900/30 border border-yellow-500/30 p-4 rounded-lg mb-6">
        <p className="text-yellow-200 text-sm">
          ⚠️ <strong>Admin Only:</strong> Add or remove players for any team. Use with caution!
        </p>
      </div>

      {/* Team Filter */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <label className="block text-white font-semibold mb-2">Filter by Team:</label>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="px-4 py-2 rounded bg-gray-700 text-white border border-gray-600"
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
        <div className="bg-gray-800 p-6 rounded-lg">
          <p className="text-gray-400">Loading players...</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="bg-gray-800 p-6 rounded-lg">
          <p className="text-gray-400">No players found.</p>
        </div>
      ) : (
        Object.entries(playersByTeam).map(([teamName, teamPlayers]) => (
          <div key={teamName} className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
            <h3 className="text-xl font-semibold mb-4 text-white">
              {teamName} ({teamPlayers.length} players)
            </h3>
            <div className="space-y-3">
              {teamPlayers.map((player) => (
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
                      {player.rosterSlot && (
                        <span className={`${player.rosterSlot === 'reserve' ? 'bg-gray-600' : 'bg-green-600'} text-white text-xs px-2 py-1 rounded`}>
                          {player.rosterSlot === 'reserve' ? 'RESERVE' : 'ACTIVE'}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium text-lg">{player.name}</p>
                    <p className="text-gray-400 text-sm">{player.positionName} • Round {player.round}</p>
                  </div>
                  <button
                    onClick={() => removePlayer(player.id, player.name)}
                    disabled={removing === player.id}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors ml-4"
                  >
                    {removing === player.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Note about adding players */}
      <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-lg mt-6">
        <p className="text-blue-200 text-sm">
          💡 <strong>To add players:</strong> Players can use the "NHL Rosters" tab during their draft turn. 
          For manual commissioner adds outside the draft, you can temporarily enable their turn or modify the draft state.
        </p>
      </div>
    </div>
  );
}
