import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
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
}

export default function PlayerList() {
  const { myTeam } = useLeague();
  const [players, setPlayers] = useState<DraftedPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch only players drafted by your team
  const fetchPlayers = async () => {
    if (!myTeam) {
      console.log('No team assigned to user');
      return;
    }
    
    try {
      setLoading(true);
      
      // Query only players drafted by your team
      const q = query(
        collection(db, 'draftedPlayers'),
        where('draftedByTeam', '==', myTeam.teamName),
        orderBy('pickNumber', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const playersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DraftedPlayer));
      
      setPlayers(playersData);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  // Undraft a player (remove from drafted list)
  const undraftPlayer = async (playerId: string) => {
    try {
      await deleteDoc(doc(db, 'draftedPlayers', playerId));
      fetchPlayers(); // Refresh the list
    } catch (error) {
      console.error('Error undrafting player:', error);
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

  // Fetch players on component mount and when myTeam changes
  useEffect(() => {
    fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeam]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">{myTeam?.teamName || 'My'}'s Roster</h2>

      {/* Drafted Players List */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-white">
          My Drafted Players ({players.length})
        </h3>
        {loading ? (
          <p className="text-gray-400">Loading players...</p>
        ) : players.length === 0 ? (
          <p className="text-gray-400">
            No players drafted yet. Go to the "NHL Rosters" tab and click "Draft Player" on any player!
          </p>
        ) : (
          <div className="space-y-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-gray-700 p-4 rounded-lg hover:bg-gray-650 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold">#{player.jerseyNumber}</span>
                    <span
                      className={`${getPositionBadgeColor(player.position)} text-white text-xs px-2 py-1 rounded font-bold`}
                    >
                      {player.position}
                    </span>
                    <span className="text-gray-400 text-sm">({player.nhlTeam})</span>
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                      Pick #{player.pickNumber}
                    </span>
                  </div>
                  <p className="text-white font-medium text-lg">{player.name}</p>
                  <p className="text-gray-400 text-sm">{player.positionName} • Round {player.round}</p>
                </div>
                <button
                  onClick={() => undraftPlayer(player.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors ml-4"
                >
                  Undraft
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
