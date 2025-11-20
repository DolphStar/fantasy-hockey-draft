import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useDraft } from '../context/DraftContext';
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

export default function DraftBoard() {
  const { league } = useLeague();
  const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const { draftState, currentPick } = useDraft();

  // Fetch all drafted players in draft order
  const fetchDraftedPlayers = async () => {
    try {
      setLoading(true);
      
      const q = query(
        collection(db, 'draftedPlayers'),
        orderBy('pickNumber', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const playersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DraftedPlayer));
      
      setDraftedPlayers(playersData);
    } catch (error) {
      console.error('Error fetching drafted players:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraftedPlayers();
    
    // Refresh every few seconds to show new picks
    const interval = setInterval(fetchDraftedPlayers, 3000);
    return () => clearInterval(interval);
  }, []);

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

  // Get team color (you can customize these)
  const getTeamColor = (teamName: string) => {
    const colors: Record<string, string> = {
      'My Team': 'border-l-4 border-green-500 bg-green-900/20',
      'Friend 1': 'border-l-4 border-blue-500 bg-blue-900/20',
      'Friend 2': 'border-l-4 border-yellow-500 bg-yellow-900/20',
      'Friend 3': 'border-l-4 border-red-500 bg-red-900/20',
    };
    return colors[teamName] || 'border-l-4 border-gray-500 bg-gray-900/20';
  };

  // Show message if no league
  if (!league) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-white">Draft Board</h2>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
          <p className="text-gray-400">No league found. Create or join a league to see the draft board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">Draft Board</h2>

      {/* Draft Progress */}
      {draftState && (
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Draft Progress</p>
              <p className="text-white text-xl font-bold">
                {draftedPlayers.length} of {draftState.totalPicks} picks made
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Current Pick</p>
              <p className="text-white text-xl font-bold">
                {currentPick ? `#${currentPick.pick} - ${currentPick.team}` : 'Draft Complete'}
              </p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(draftedPlayers.length / draftState.totalPicks) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Draft Board */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-white">All Picks</h3>
        
        {loading && draftedPlayers.length === 0 ? (
          <p className="text-gray-400">Loading draft board...</p>
        ) : draftedPlayers.length === 0 ? (
          <p className="text-gray-400">No picks made yet. Start drafting!</p>
        ) : (
          <div className="space-y-2">
            {draftedPlayers.map((player) => (
              <div
                key={player.id}
                className={`${getTeamColor(player.draftedByTeam)} p-4 rounded-lg transition-all hover:bg-opacity-40`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Pick Number */}
                    <div className="flex flex-col items-center min-w-[60px]">
                      <span className="text-gray-400 text-xs">Pick</span>
                      <span className="text-white font-bold text-xl">#{player.pickNumber}</span>
                      <span className="text-gray-500 text-xs">Rd {player.round}</span>
                    </div>

                    {/* Team Badge */}
                    <div className="min-w-[100px]">
                      <span className="bg-gray-700 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        {player.draftedByTeam}
                      </span>
                    </div>

                    {/* Player Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">#{player.jerseyNumber}</span>
                        <span
                          className={`${getPositionBadgeColor(player.position)} text-white text-xs px-2 py-1 rounded font-bold`}
                        >
                          {player.position}
                        </span>
                        <span className="text-gray-400 text-sm">({player.nhlTeam})</span>
                      </div>
                      <p className="text-white font-medium text-lg">{player.name}</p>
                      <p className="text-gray-400 text-sm">{player.positionName}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Summary */}
      {draftedPlayers.length > 0 && draftState && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {draftState.draftOrder
            .map(pick => pick.team)
            .filter((team, index, arr) => arr.indexOf(team) === index) // Get unique teams
            .map(teamName => {
              const teamPlayers = draftedPlayers.filter(p => p.draftedByTeam === teamName);
              return (
                <div key={teamName} className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="text-white font-bold text-lg mb-2">{teamName}</h4>
                  <p className="text-gray-400 mb-2">{teamPlayers.length} players drafted</p>
                  {teamPlayers.length > 0 && (
                    <div className="text-sm text-gray-400">
                      <p>Forwards: {teamPlayers.filter(p => ['C', 'L', 'R'].includes(p.position)).length}</p>
                      <p>Defense: {teamPlayers.filter(p => p.position === 'D').length}</p>
                      <p>Goalies: {teamPlayers.filter(p => p.position === 'G').length}</p>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
